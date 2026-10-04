"""One manually started backfill; resumes after source rate limits, never bypassing them."""
from pathlib import Path
import argparse, datetime as dt, json, subprocess, sys, time
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--not-before',help='UTC ISO time before which no source requests are made')
parser.add_argument('--years',nargs='+',default=[str(y) for y in range(2023,dt.datetime.now(dt.timezone.utc).year+1)])
args=parser.parse_args()
archive=ROOT/'archive';archive.mkdir(exist_ok=True)
state=archive/'backfill-status.json'
def status(phase,**details):
    state.write_text(json.dumps({'phase':phase,'updatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),**details},indent=2),encoding='utf-8')
def wait_until(stamp):
    status('waiting_for_rate_limit',resumeAt=stamp.isoformat())
    print('Waiting until '+stamp.isoformat()+' before more source requests.',flush=True)
    while (remaining:=(stamp-dt.datetime.now(dt.timezone.utc)).total_seconds())>0:time.sleep(min(60,remaining))
if args.not_before:wait_until(dt.datetime.fromisoformat(args.not_before))
while True:
    status('importing');log=archive/'backfill-attempt.log'
    with log.open('w',encoding='utf-8') as output:
        result=subprocess.run([sys.executable,str(ROOT/'scripts/import-archive.py'),'--years',*args.years,'--publish'],cwd=ROOT,stdout=output,stderr=subprocess.STDOUT)
    text=log.read_text(encoding='utf-8')
    if 'RateLimitExceededError' in text:
        wait_until(dt.datetime.now(dt.timezone.utc)+dt.timedelta(hours=1));continue
    index=json.loads((archive/'index.json').read_text(encoding='utf-8'))
    unavailable=[e['id'] for e in index.values() if e['status']=='unavailable']
    publication_errors=[e['id'] for e in index.values() if e.get('error')]
    status('completed_with_gaps' if unavailable or publication_errors or result.returncode else 'completed',unavailable=unavailable,publicationErrors=publication_errors,exitCode=result.returncode)
    print('Backfill finished; see archive/coverage.md and archive/backfill-status.json.',flush=True)
    sys.exit(1 if publication_errors or result.returncode else 0)
