"""Import and cache one completed race; no network access is needed by visitors."""
from pathlib import Path
import sys, json, datetime
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.import-deps'))
import fastf1
import pandas as pd

cache = ROOT / '.fastf1-cache'
cache.mkdir(exist_ok=True)
fastf1.Cache.enable_cache(str(cache))
session = fastf1.get_session(2024, 'Monza', 'R')
session.load(telemetry=False, weather=True, messages=True)

def scalar(value):
    if pd.isna(value): return None
    if isinstance(value, (pd.Timedelta, datetime.timedelta)): return round(value.total_seconds(), 3)
    if isinstance(value, (pd.Timestamp, datetime.datetime)): return value.isoformat()
    if hasattr(value, 'item'): return value.item()
    return value

def records(frame, columns):
    return [{c: scalar(row[c]) for c in columns} for _, row in frame.iterrows()]

out = {
    'schemaVersion': 1,
    'importedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'source': {'name': 'FastF1', 'version': fastf1.__version__, 'url': 'https://github.com/theOehrly/Fast-F1', 'timingPath': session.api_path},
    'event': {'year': 2024, 'round': 16, 'name': 'Italian Grand Prix', 'date': '2024-09-01', 'laps': int(session.total_laps), 'startTime': scalar(session.session_start_time)},
    'drivers': records(session.results, ['Abbreviation','DriverNumber','FullName','TeamName','TeamColor','GridPosition','Position','ClassifiedPosition','Status','Time']),
    'laps': records(session.laps, ['Driver','LapNumber','LapTime','Time','LapStartTime','PitInTime','PitOutTime','Stint','Compound','TyreLife','FreshTyre','TrackStatus','Position','IsAccurate','Deleted','FastF1Generated']),
    'weather': records(session.weather_data, ['Time','AirTemp','TrackTemp','Rainfall']),
    'trackStatus': records(session.track_status, ['Time','Status','Message']),
    'raceControl': records(session.race_control_messages, list(session.race_control_messages.columns)),
}
assert len(out['drivers']) == 20 and len(out['laps']) > 900
assert out['event']['laps'] == 53
target = ROOT / 'src' / 'data' / 'monza-2024.json'
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(out, ensure_ascii=False, allow_nan=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'file': str(target), 'laps': len(out['laps']), 'results': [{k:d[k] for k in ['Abbreviation','Position','Status']} for d in out['drivers']], 'trackStatus':out['trackStatus']}))
