#!/usr/bin/env python3
"""Public repository snapshots and immutable environment evidence. No framework edits."""
import concurrent.futures, datetime, json, pathlib, platform, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'raw-results' / 'audit'
OUT.mkdir(parents=True, exist_ok=True)
REPOS = {
 'fougere': 'https://github.com/chok/fougere.git',
 'nest': 'https://github.com/nestjs/nest.git',
 'adonis': 'https://github.com/adonisjs/core.git',
 'effect': 'https://github.com/Effect-TS/effect.git',
 'encore': 'https://github.com/encoredev/encore.git',
 'deepkit': 'https://github.com/deepkit/deepkit-framework.git',
}
def run(cmd, cwd=None, timeout=180):
    try:
        p = subprocess.run(cmd, cwd=cwd or ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)
        return dict(command=cmd, cwd=str(cwd or ROOT), exit_code=p.returncode, output=p.stdout)
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        return dict(command=cmd, cwd=str(cwd or ROOT), exit_code=None, output=str(e))
def audit(item):
    name,url=item
    dest=ROOT/'vendor'/name
    results=[]
    if not (dest/'.git').exists():
        results.append(run(['git','clone','--depth','1',url,str(dest)]))
    if (dest/'.git').exists():
        for cmd in [['git','rev-parse','HEAD'],['git','remote','-v'],['git','status','--porcelain'],['git','log','-1','--format=%cI %s']]:
            results.append(run(cmd,dest))
        manifests=[]
        for path in dest.rglob('package.json'):
            if any(x in path.parts for x in ['node_modules','.git']): continue
            try:
                data=json.loads(path.read_text())
                manifests.append(dict(path=str(path.relative_to(dest)),**{k:data.get(k) for k in ['name','version','engines','dependencies','peerDependencies','scripts']}))
            except (ValueError,OSError): pass
        (OUT/f'{name}-manifests.json').write_text(json.dumps(manifests,indent=2))
    (OUT/f'{name}.json').write_text(json.dumps(dict(url=url,results=results),indent=2))
    return name, results[0]['exit_code'] if results else None
if __name__=='__main__':
    env=dict(timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(), platform=platform.platform(),commands=[])
    for cmd in [['node','--version'],['npm','--version'],['pnpm','--version'],['postgres','--version'],['encore','version'],['sysctl','-n','machdep.cpu.brand_string'],['sysctl','-n','hw.memsize'],['git','rev-parse','HEAD'],['git','status','--porcelain']]:
        env['commands'].append(run(cmd,ROOT.parent))
    (OUT/'environment.json').write_text(json.dumps(env,indent=2))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for name,status in pool.map(audit,REPOS.items()): print(name,status,flush=True)
