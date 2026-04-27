import os
import sqlite3
import threading
import pandas as pd
from urllib.parse import urlparse
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# This is the single switch for your entire system
# Example: postgresql://user:pass@host:port/dbname
DATABASE_URL = os.getenv("DATABASE_URL")

# SQLite connection pool — one cached connection per db_path, thread-safe
_sqlite_pool: dict = {}
_pool_lock = threading.Lock()

def _get_sqlite_connection(db_path: str) -> sqlite3.Connection:
    with _pool_lock:
        if db_path not in _sqlite_pool:
            conn = sqlite3.connect(db_path, check_same_thread=False)
            conn.execute("PRAGMA journal_mode=WAL")   # concurrent reads
            conn.execute("PRAGMA synchronous=NORMAL") # safe + faster than FULL
            _sqlite_pool[db_path] = conn
        return _sqlite_pool[db_path]

def get_connection(db_path=None):
    """Returns a connection object based on availability of Cloud Postgres."""
    if DATABASE_URL:
        try:
            import psycopg2
            conn_str = DATABASE_URL
            if conn_str.startswith("postgres://"):
                conn_str = conn_str.replace("postgres://", "postgresql://", 1)
            return psycopg2.connect(conn_str)
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise e
    else:
        if not db_path:
            ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
            db_path = os.path.join(ROOT_DIR, "dyno_backend", "raptee_dyno.db")
        return _get_sqlite_connection(db_path)

def query_to_df(query, params=None, db_path=None):
    """Runs a query and returns a Pandas DataFrame, handling both DB types."""
    conn = get_connection(db_path)
    is_pg = bool(DATABASE_URL)
    try:
        if is_pg and "?" in query:
            query = query.replace("?", "%s")
        df = pd.read_sql_query(query, conn, params=params)
        return df
    finally:
        if is_pg:
            conn.close()  # Postgres: close per-call; SQLite: pooled, keep open

def execute_sql(query, params=None, db_path=None):
    """Executes a command (INSERT/UPDATE/DELETE)."""
    conn = get_connection(db_path)
    is_pg = bool(DATABASE_URL)
    try:
        if is_pg and "?" in query:
            query = query.replace("?", "%s")
        cursor = conn.cursor()
        cursor.execute(query, params or [])
        conn.commit()
    finally:
        if is_pg:
            conn.close()

def df_to_db(df, table_name, db_path=None, if_exists="append"):
    """Saves a DataFrame to the database."""
    conn = get_connection(db_path)
    is_pg = bool(DATABASE_URL)
    try:
        df.to_sql(table_name, conn, if_exists=if_exists, index=False)
    finally:
        if is_pg:
            conn.close()
