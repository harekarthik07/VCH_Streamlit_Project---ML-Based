import os
import sqlite3
import pandas as pd
from urllib.parse import urlparse
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# This is the single switch for your entire system
# Example: postgresql://user:pass@host:port/dbname
DATABASE_URL = os.getenv("DATABASE_URL")

def get_connection(db_path=None):
    """Returns a connection object based on availability of Cloud Postgres."""
    if DATABASE_URL:
        try:
            import psycopg2
            # Handle standard postgresql:// vs postgres:// (Render/Heroku use postgres://)
            conn_str = DATABASE_URL
            if conn_str.startswith("postgres://"):
                conn_str = conn_str.replace("postgres://", "postgresql://", 1)
            
            return psycopg2.connect(conn_str)
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            # If Postgres fails, we don't want to silently fallback to a potentially empty SQLite 
            # unless we are in development mode.
            raise e
    else:
        # Fallback to local SQLite
        if not db_path:
            ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
            # We assume dyno is the primary if no path given, but we should be specific
            db_path = os.path.join(ROOT_DIR, "dyno_backend", "raptee_dyno.db")
        
        return sqlite3.connect(db_path)

def query_to_df(query, params=None, db_path=None):
    """Runs a query and returns a Pandas DataFrame, handling both DB types."""
    conn = get_connection(db_path)
    try:
        # Replace ? with %s for PostgreSQL compatibility if needed
        if DATABASE_URL and "?" in query:
            query = query.replace("?", "%s")
        
        df = pd.read_sql_query(query, conn, params=params)
        return df
    finally:
        conn.close()

def execute_sql(query, params=None, db_path=None):
    """Executes a command (INSERT/UPDATE/DELETE)."""
    conn = get_connection(db_path)
    try:
        # Replace ? with %s for PostgreSQL compatibility
        if DATABASE_URL and "?" in query:
            query = query.replace("?", "%s")
            
        cursor = conn.cursor()
        cursor.execute(query, params or [])
        conn.commit()
    finally:
        conn.close()

def df_to_db(df, table_name, db_path=None, if_exists="append"):
    """Saves a DataFrame to the database."""
    conn = get_connection(db_path)
    try:
        # PostgreSQL requires a slightly different method for to_sql in some pandas versions,
        # but generally read_sql handles it via the connection object.
        df.to_sql(table_name, conn, if_exists=if_exists, index=False)
    finally:
        conn.close()
