#!/usr/bin/env python3
"""
Standalone script to solve Turnstile directly from command line
Usage: python solve_turnstile.py <url> <sitekey>
"""
import asyncio
import sys
import json
from async_solver import get_turnstile_token

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"status": "error", "error": "Usage: python solve_turnstile.py <url> <sitekey>"}), file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    sitekey = sys.argv[2]
    
    try:
        result = await get_turnstile_token(
            url=url,
            sitekey=sitekey,
            debug=False,
            headless=True,
            useragent=None,
            browser_type="chromium"
        )
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

