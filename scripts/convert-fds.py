"""Map an FDS *_devc.csv (two header rows) into canonical Twin field CSV.
No FDS solver is run by this converter. Device mapping and normalization are
explicit: optical extinction k (1/m) is converted with 1-exp(-k*path_length_m).
Usage: python scripts/convert-fds.py input_devc.csv mapping.json output.csv
mapping example: {"R302":{"temperature":"T_302","extinction":"K_302","path_length_m":1}}
"""
import csv,json,math,sys
from pathlib import Path
if len(sys.argv)!=4:raise SystemExit('Usage: input_devc.csv mapping.json output.csv')
src,mapping_path,dst=map(Path,sys.argv[1:])
mapping=json.loads(mapping_path.read_text(encoding='utf-8'))
with src.open(encoding='utf-8-sig',newline='') as f:rows=list(csv.reader(f))
if len(rows)<3:raise ValueError('FDS device CSV needs units, names and data rows')
headers=[x.strip().strip('"') for x in rows[1]]
time_index=next((i for i,n in enumerate(headers) if n.lower()=='time'),None)
if time_index is None:raise ValueError('Missing Time column')
required=set()
for space,cfg in mapping.items():
    required.update([cfg['temperature'],cfg['extinction']])
    if not math.isfinite(float(cfg['path_length_m'])) or cfg['path_length_m']<=0:raise ValueError('path_length_m must be positive')
if not required.issubset(headers):raise ValueError(f'Missing devices: {required-set(headers)}')
with dst.open('w',encoding='utf-8',newline='') as f:
    writer=csv.writer(f);writer.writerow(['time','space_id','temperature_c','smoke_index','fire_index'])
    for values in rows[2:]:
        if not values:continue
        for space,cfg in mapping.items():
            t=float(values[time_index]);temperature=float(values[headers.index(cfg['temperature'])]);k=float(values[headers.index(cfg['extinction'])])
            if not all(math.isfinite(x) for x in [t,temperature,k]) or t<0 or k<0:raise ValueError('Invalid FDS device value')
            writer.writerow([t,space,temperature,1-math.exp(-k*cfg['path_length_m']),0])
print('Converted external FDS device data:',dst)
