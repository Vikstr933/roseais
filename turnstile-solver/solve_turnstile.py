#!/usr/bin/env python3
"""
Standalone script to solve Turnstile directly from command line
Usage: python solve_turnstile.py <url> <sitekey> [browser_type]
browser_type: chromium (default), camoufox, chrome, msedge
"""
import asyncio
import sys
import json

# Check if camoufox is available before importing async_solver
try:
    import camoufox
    CAMOUFOX_AVAILABLE = True
except ImportError:
    CAMOUFOX_AVAILABLE = False

from async_solver import get_turnstile_token

async def main():
    if len(sys.argv) < 3:
        print(json.dumps({"status": "error", "error": "Usage: python solve_turnstile.py <url> <sitekey> [browser_type]"}), file=sys.stderr)
        sys.exit(1)
    
    url = sys.argv[1]
    sitekey = sys.argv[2]
    # Use camoufox by default if available, otherwise use chromium
    requested_browser = sys.argv[3] if len(sys.argv) > 3 else None
    
    # Determine which browser to use
    if requested_browser:
        browser_type = requested_browser
    elif CAMOUFOX_AVAILABLE:
        browser_type = "camoufox"
    else:
        browser_type = "chromium"
        # Log that we're using chromium fallback
        print(json.dumps({"status": "info", "message": "camoufox not available, using chromium"}), file=sys.stderr)
    
    try:
        result = await get_turnstile_token(
            url=url,
            sitekey=sitekey,
            debug=False,
            headless=True,
            useragent=None,
            browser_type=browser_type
        )
        print(json.dumps(result))
    except Exception as e:
        # If camoufox was requested but failed, try chromium as fallback
        if browser_type == "camoufox" and CAMOUFOX_AVAILABLE:
            try:
                print(json.dumps({"status": "info", "message": "camoufox failed, trying chromium fallback"}), file=sys.stderr)
                result = await get_turnstile_token(
                    url=url,
                    sitekey=sitekey,
                    debug=False,
                    headless=True,
                    useragent=None,
                    browser_type="chromium"
                )
                print(json.dumps(result))
            except Exception as e2:
                print(json.dumps({"status": "error", "error": f"Both camoufox and chromium failed. Last error: {str(e2)}"}), file=sys.stderr)
                sys.exit(1)
        else:
            print(json.dumps({"status": "error", "error": str(e)}), file=sys.stderr)
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())

