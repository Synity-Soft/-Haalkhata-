#!/usr/bin/env python3
"""
BazarBondhu AI — Live HTTP API Verification Script
==================================================

Sends actual HTTP requests to the running Uvicorn server on http://127.0.0.1:8000
and logs actual request and response payloads.
"""

import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"


def send_request(method: str, path: str, payload=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode("utf-8") if payload else None
    headers = {"Content-Type": "application/json"} if payload else {}

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            status_code = resp.getcode()
            body = json.loads(resp.read().decode("utf-8"))
            return status_code, body
    except urllib.error.HTTPError as e:
        status_code = e.code
        body = json.loads(e.read().decode("utf-8"))
        return status_code, body


def main():
    print("=" * 76)
    print("      BazarBondhu AI — Live HTTP API End-to-End Verification")
    print(f"      Target Server: {BASE_URL}")
    print("=" * 76)

    # 1. GET /
    print("\n[1/5] Testing GET / ...")
    c, r = send_request("GET", "/")
    print(f"      HTTP Status: {c}")
    print(f"      Response: {json.dumps(r, indent=2)}")
    assert c == 200 and r["status"] == "online"

    # 2. GET /health
    print("\n[2/5] Testing GET /health ...")
    c, r = send_request("GET", "/health")
    print(f"      HTTP Status: {c}")
    print(f"      Response: {json.dumps(r, indent=2)}")
    assert c == 200 and r["status"] == "healthy"

    # 3. POST /api/v1/predict (Valid request)
    print("\n[3/5] Testing POST /api/v1/predict (Valid Query) ...")
    req_body = {
        "outlet_id": "OUT001",
        "product_id": "PRD047",
        "forecast_date": "2026-08-01"
    }
    print(f"      Request Payload: {json.dumps(req_body)}")
    c, r = send_request("POST", "/api/v1/predict", req_body)
    print(f"      HTTP Status: {c}")
    print(f"      Response: {json.dumps(r, indent=2)}")
    assert c == 200 and r["success"] is True
    assert r["forecast_7d"] > 0 and r["forecast_30d"] > 0

    # 4. GET /api/v1/products/OUT001
    print("\n[4/5] Testing GET /api/v1/products/OUT001 ...")
    c, r = send_request("GET", "/api/v1/products/OUT001")
    print(f"      HTTP Status: {c}")
    print(f"      Total Products Returned: {r['total_products']}")
    print(f"      First 2 Products:")
    for p in r["products"][:2]:
        print(f"        • {p['product_id']}: {p['brand']} {p['subcategory']} ({p['package_size']}) - ৳ {p['selling_price_bdt']} BDT")
    assert c == 200 and r["total_products"] > 0

    # 5. Error Cases
    print("\n[5/5] Testing Error Cases against Live Server ...")

    # A: Unknown outlet (404)
    c, r = send_request("POST", "/api/v1/predict", {"outlet_id": "OUT999", "product_id": "PRD047", "forecast_date": "2026-08-01"})
    print(f"      Unknown Outlet: HTTP {c} -> {r['detail']}")
    assert c == 404

    # B: Unsupported future date 2026-11-17 (400)
    c, r = send_request("POST", "/api/v1/predict", {"outlet_id": "OUT001", "product_id": "PRD047", "forecast_date": "2026-11-17"})
    print(f"      Unsupported Date (2026-11-17): HTTP {c} -> {r['detail']}")
    assert c == 400

    # C: Unknown outlet products (404)
    c, r = send_request("GET", "/api/v1/products/OUT999")
    print(f"      Unknown Outlet Products: HTTP {c} -> {r['detail']}")
    assert c == 404

    print("\n" + "=" * 76)
    print("ALL LIVE HTTP REQUESTS VERIFIED SUCCESSFULLY ON RUNNING UVICORN SERVER!")
    print("=" * 76)


if __name__ == "__main__":
    main()
