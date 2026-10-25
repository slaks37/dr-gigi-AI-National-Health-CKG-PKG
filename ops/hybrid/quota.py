"""Scenario calculator, not provider telemetry or a guaranteed zero-cost forecast."""
import json
from pathlib import Path

def scenarios():
    result=[]
    for accounts in (100,1000,10000):
        daily_active=round(accounts*.2)
        reads=daily_active*50 # two 20-head pages + profile/transaction/rules safety allowance
        writes=daily_active*3 # one head + one immutable revision + one preference update
        storage=accounts*3*4*16*1024 # 3 records/account; head + 3 revisions; 16 KiB encrypted document
        egress=daily_active*2*20*16*1024*30 # 2 sessions x 20 heads per day, 30 days
        values={'accounts':accounts,'daily_active':daily_active,'reads_per_day':reads,'writes_per_day':writes,
            'storage_bytes':storage,'egress_bytes_per_month':egress}
        limits={'reads_per_day':50000,'writes_per_day':20000,'storage_bytes':1024**3,'egress_bytes_per_month':10*1024**3}
        values['limits_exceeded']=[k for k,v in limits.items() if values[k]>v]
        result.append(values)
    return {'schema':'sonri.hybrid.quota-scenarios.v1','provider_telemetry':False,'assumptions':'20% daily active, 2 sessions/day, 20 heads/session, 1 edit/day, 3 retained records/account, head+3 revisions, 16 KiB/document; extra reads are a conservative allowance, not measured billing.',
        'plan':'SPARK_NO_BILLING_LINK_ALLOWED','snapshots_checked_on':'2026-10-25','scenarios':result}
if __name__=='__main__':
    result=scenarios();target=Path(__file__).parent/'pages/quota-scenarios.json';target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
