import os, time, boto3, requests
def log(m): print("[bootstrap]", m, flush=True)
def ensure_bucket():
    if os.getenv("ARTIFACT_BACKEND","local") != "s3":
        log("ARTIFACT_BACKEND != s3; skipping bucket"); return
    s3=boto3.client("s3", endpoint_url=os.getenv("S3_ENDPOINT_URL"), aws_access_key_id=os.getenv("S3_ACCESS_KEY"), aws_secret_access_key=os.getenv("S3_SECRET_KEY"), region_name=os.getenv("S3_REGION","us-east-1"))
    bucket=os.getenv("S3_BUCKET","bidfast-artifacts")
    try: s3.head_bucket(Bucket=bucket); log(f"Bucket exists: {bucket}")
    except Exception:
        log(f"Creating bucket: {bucket}")
        if os.getenv("S3_REGION","us-east-1")=="us-east-1": s3.create_bucket(Bucket=bucket)
        else: s3.create_bucket(Bucket=bucket, CreateBucketConfiguration={"LocationConstraint": os.getenv("S3_REGION")})
        log("Bucket created")
def ensure_dns():
    provider=os.getenv("DNS_PROVIDER","").strip().lower(); ip=os.getenv("SERVER_PUBLIC_IP","").strip(); domain=os.getenv("PRIMARY_DOMAIN","example.com")
    if not provider or not ip: log("DNS disabled or missing SERVER_PUBLIC_IP"); return
    name=f"*.preview.{domain}".rstrip(".")
    if provider=="cloudflare":
        headers={"Authorization":f"Bearer {os.getenv('CLOUDFLARE_API_TOKEN')}","Content-Type":"application/json"}
        base=f"https://api.cloudflare.com/client/v4/zones/{os.getenv('CLOUDFLARE_ZONE_ID')}/dns_records"
        r=requests.get(base, params={"type":"A","name":name}, timeout=20, headers=headers); rec_id=None
        if r.ok and r.json().get("success"): res=r.json().get("result",[]); rec_id = res[0]["id"] if res else None
        payload={"type":"A","name":name,"content":ip,"ttl":60,"proxied":False}
        if rec_id: requests.put(f"{base}/{rec_id}", json=payload, headers=headers, timeout=20)
        else: requests.post(base, json=payload, headers=headers, timeout=20)
        log(f"Cloudflare: ensured {name} -> {ip}")
    elif provider=="route53":
        boto3.client("route53").change_resource_record_sets(HostedZoneId=os.getenv("HOSTED_ZONE_ID"), ChangeBatch={'Changes':[{'Action':'UPSERT','ResourceRecordSet':{'Name':name,'Type':'A','TTL':60,'ResourceRecords':[{'Value':ip}]}}]})
        log(f"Route53: ensured {name} -> {ip}")
    else: log("Unknown DNS provider")
def main(): time.sleep(3); ensure_bucket(); ensure_dns(); log("Bootstrap complete")
if __name__=="__main__": main()
