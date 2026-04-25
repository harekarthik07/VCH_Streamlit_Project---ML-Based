import sqlite3
import pandas as pd
import os
import db_bridge
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate():
    """
    Copies all data from local SQLite databases to the PostgreSQL database 
    specified in the DATABASE_URL environment variable.
    """
    # 1. Check if Postgres is configured
    if not db_bridge.DATABASE_URL:
        print("\n" + "="*50)
        print("❌ ERROR: DATABASE_URL environment variable is missing!")
        print("="*50)
        print("To migrate, you must set the environment variable first:")
        print("Windows (PowerShell): $env:DATABASE_URL=\"postgresql://user:pass@host:port/dbname\"")
        print("Windows (CMD): set DATABASE_URL=postgresql://user:pass@host:port/dbname")
        print("="*50 + "\n")
        return

    # 2. Define the databases to migrate
    ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
    dbs = {
        "Dyno": {
            "path": os.path.join(ROOT_DIR, "dyno_backend", "raptee_dyno.db"),
        },
        "Road": {
            "path": os.path.join(ROOT_DIR, "road_backend", "raptee_rides.db"),
        }
    }

    print("\n🚀 STARTING ENTERPRISE CLOUD MIGRATION")
    print(f"Target: {db_bridge.DATABASE_URL.split('@')[-1] if '@' in db_bridge.DATABASE_URL else 'Remote Server'}")
    print("-" * 50)

    for suite, config in dbs.items():
        if not os.path.exists(config["path"]):
            print(f"⚠️ Skipping {suite} Suite: SQLite file not found at {config['path']}")
            continue
            
        print(f"📦 Processing {suite} Suite...")
        try:
            conn_lite = sqlite3.connect(config["path"])
            
            # Get all tables (including dynamically created envelopes)
            cursor = conn_lite.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in cursor.fetchall() if not row[0].startswith('sqlite_')]
            
            for table in tables:
                print(f"  - Syncing Table: {table}...", end=" ", flush=True)
                df = pd.read_sql_query(f"SELECT * FROM \"{table}\"", conn_lite)
                
                if not df.empty:
                    # Write to Postgres via the bridge
                    # We use if_exists="replace" to ensure the schema is created correctly on first run
                    db_bridge.df_to_db(df, table, if_exists="replace")
                    print(f"✅ Done ({len(df)} rows)")
                else:
                    # Even if empty, create the table schema
                    db_bridge.df_to_db(df, table, if_exists="replace")
                    print("✅ Schema created (Empty table)")
            
            conn_lite.close()
        except Exception as e:
            print(f"❌ Error migrating {suite}: {e}")
    
    print("-" * 50)
    print("✅ CLOUD SYNC COMPLETE!")
    print("Your Next.js Dashboard and Streamlit App are now ready for the Cloud.")
    print("=" * 50 + "\n")

if __name__ == "__main__":
    migrate()
