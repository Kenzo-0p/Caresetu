"""Reset CareSetu to deterministic synthetic demo data.

Run from /app/backend with: python seed.py
"""

import asyncio

from services.seed import reset_demo_data


if __name__ == "__main__":
    asyncio.run(reset_demo_data())
    print("CareSetu demo data reset")