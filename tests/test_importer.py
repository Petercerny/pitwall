import importlib.util, json, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('archive_importer',Path(__file__).resolve().parents[1]/'scripts/import-archive.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class ImportTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'session.json'
        self.data={'schemaVersion':2,'importedAt':'2024-09-01T15:00:00Z','source':{'name':'FastF1'},'drivers':[]}
        module.write_json(self.path,self.data)
        self.entry={'id':'2024-16-R','status':'available','file':'local.json','error':'old error','published':False}
    def tearDown(self):self.temp.cleanup()
    def test_failed_upload_never_updates_published_pointer(self):
        calls=[]
        def fail(path,*args):calls.append(path);raise RuntimeError('unavailable')
        with patch.object(module,'api',side_effect=fail):
            with self.assertRaises(RuntimeError):module.publish(self.entry,self.path)
        self.assertEqual(len(calls),1);self.assertIn('/storage/',calls[0])
    def test_repeat_import_uses_same_object_and_upsert_id(self):
        with patch.object(module,'api',return_value=b'{}') as api:
            module.publish(self.entry,self.path);module.publish(self.entry,self.path)
        self.assertEqual(api.call_args_list[0].args[0],api.call_args_list[2].args[0])
        row=json.loads(api.call_args_list[1].args[2]);self.assertEqual(row['id'],'2024-16-R');self.assertNotIn('error',row);self.assertNotIn('file',row);self.assertEqual(row['checksum']+'.json',row['object_path'].split('/')[-1])
    def test_failed_serialization_preserves_previous_snapshot(self):
        with self.assertRaises(ValueError):module.write_json(self.path,{'bad':float('nan')})
        self.assertEqual(json.loads(self.path.read_text()),self.data)
    def test_secret_key_uses_apikey_not_bearer(self):
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self):return b'{}'
        with patch.dict(module.os.environ,{'SUPABASE_URL':'https://example.invalid','SUPABASE_SECRET_KEY':'sb_secret_test'}),patch.object(module.urllib.request,'urlopen',return_value=Response()) as request:
            module.api('/rest/v1/archive_sessions')
            headers={k.lower():v for k,v in request.call_args.args[0].headers.items()}
            self.assertEqual(headers['apikey'],'sb_secret_test');self.assertNotIn('authorization',headers)
    def test_transient_failure_retries(self):
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self):return b'{}'
        with patch.dict(module.os.environ,{'SUPABASE_URL':'https://example.invalid','SUPABASE_SECRET_KEY':'sb_secret_test'}),patch.object(module.urllib.request,'urlopen',side_effect=[TimeoutError(),Response()]) as request,patch.object(module.time,'sleep'):
            self.assertEqual(module.api('/rest/v1/archive_sessions'),b'{}');self.assertEqual(request.call_count,2)

if __name__=='__main__':unittest.main()
