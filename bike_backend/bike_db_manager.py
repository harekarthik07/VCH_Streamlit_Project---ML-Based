import os
import json
import shutil
import pandas as pd
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BIKE_REGISTRY_FILE = os.path.join(BASE_DIR, "bike_registry.json")
# Look in the parent dir for the default CSV path
DEFAULT_CSV_PATH = os.path.join(os.path.dirname(BASE_DIR), "Bike-Level-Details.csv")

def load_bike_registry():
    """Loads the bike hardware tracking registry."""
    if not os.path.exists(BIKE_REGISTRY_FILE):
        return {}
    with open(BIKE_REGISTRY_FILE, "r") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def save_bike_registry(registry_data):
    """Saves data to the bike hardware tracking registry."""
    with open(BIKE_REGISTRY_FILE, "w") as f:
        json.dump(registry_data, f, indent=4)

def ingest_csv_to_registry(csv_path=DEFAULT_CSV_PATH):
    """Reads the Bike-Level-Details CSV and updates the JSON registry."""
    if not os.path.exists(csv_path):
        print(f"Warning: CSV file not found at {csv_path}")
        return False
        
    try:
        df = pd.read_csv(csv_path, encoding='ISO-8859-1')
        df.columns = [str(c).strip() for c in df.columns]
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return False
        
    registry = load_bike_registry()
    updated = False
    
    for _, row in df.iterrows():
        # Get Bike No, handle float representations like 19.0 safely
        try:
            bike_no = int(float(row.get('Bike no', 0)))
        except (ValueError, TypeError):
            continue
            
        if bike_no == 0:
            continue
            
        bike_id = f"BIKE-{bike_no:02d}"
        
        # Safely extract explicitly requested fields
        def get_val(col_name):
            val = row.get(col_name, "UNASSIGNED")
            return "UNASSIGNED" if pd.isna(val) or str(val).strip() == "" else str(val).strip()

        vin = get_val('VIN')
        bb_id = get_val('Battery Box ID')
        l_mod = get_val('Left Module ID')
        r_mod = get_val('Right Module ID')
        bms = get_val('BMS ID')
        motor = get_val('Motor ID')
        
        # Only initialize tests_done and status if it's a completely new bike
        if bike_id not in registry:
            registry[bike_id] = {
                "tests_done": 0,
                "status": "Offline"
            }
            
        # Update / Overwrite hardware identifiers
        registry[bike_id].update({
            "vin": vin,
            "battery_box_id": bb_id,
            "left_module_id": l_mod,
            "right_module_id": r_mod,
            "bms_id": bms,
            "motor_id": motor
        })
        updated = True
        
    if updated:
        save_bike_registry(registry)
        return True
    return False

def update_hardware_registry(file_buffer, filename):
    """
    Reads an uploaded hardware manifest (.csv or .xlsx) and smart-merges
    into bike_registry.json. Never overwrites existing data with empty values.
    Creates a timestamped backup before writing.

    Returns (success: bool, message: str, updated_count: int)
    """
    # --- Read file ---
    try:
        if filename.lower().endswith(".xlsx"):
            df = pd.read_excel(file_buffer, engine="openpyxl")
        else:
            df = pd.read_csv(file_buffer, encoding="ISO-8859-1")
    except Exception as e:
        return False, f"Failed to read file: {e}", 0

    df.columns = [str(c).strip() for c in df.columns]

    # --- Column name aliases ---
    COL_MAP = {
        "bike_no":        ["Bike no", "Bike_ID", "Bike Number"],
        "vin":            ["Vin Number", "VIN", "Vehicle VIN", "Real VIN", "Chassis Number"],
        "powertrain_id":  ["Powertrain ID", "PTP ID"],
        "aux_battery_id": ["Aux Battery ID", "Aux_ID"],
        "battery_box_id": ["Battery Box ID", "BB_ID"],
        "motor_id":       ["Motor ID", "Unnamed: 7"],
        "left_module_id": ["Left Module ID"],
        "right_module_id":["Right Module ID"],
        "bms_id":         ["BMS ID"],
    }

    def find_col(aliases):
        for alias in aliases:
            if alias in df.columns:
                return alias
        return None

    col_refs = {field: find_col(aliases) for field, aliases in COL_MAP.items()}

    if col_refs["bike_no"] is None:
        return False, "Could not find a Bike ID column (tried: 'Bike no', 'Bike_ID', 'Bike Number').", 0

    # --- Backup registry before writing ---
    if os.path.exists(BIKE_REGISTRY_FILE):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = BIKE_REGISTRY_FILE.replace(".json", f"_backup_{ts}.json")
        shutil.copy2(BIKE_REGISTRY_FILE, backup_path)

    registry = load_bike_registry()
    updated_count = 0

    for _, row in df.iterrows():
        # Resolve bike number → BIKE-XX key
        raw_bike_no = row.get(col_refs["bike_no"])
        try:
            bike_no = int(float(str(raw_bike_no).strip()))
        except (ValueError, TypeError):
            continue
        if bike_no == 0:
            continue

        bike_id = f"BIKE-{bike_no}"

        # Initialise new bikes
        if bike_id not in registry:
            registry[bike_id] = {"tests_done": 0, "status": "Offline"}

        def extract(field):
            """Return cleaned string value, or None if blank/missing."""
            col = col_refs.get(field)
            if col is None:
                return None
            val = row.get(col)
            if val is None or (isinstance(val, float) and pd.isna(val)):
                return None
            val = str(val).strip()
            return val if val else None

        updates = {}

        # VIN
        vin = extract("vin")
        if vin:
            updates["vin"] = vin

        # Powertrain ID
        ptp = extract("powertrain_id")
        if ptp:
            updates["powertrain_id"] = ptp

        # Aux Battery
        aux = extract("aux_battery_id")
        if aux:
            updates["aux_battery_id"] = aux

        # Battery Box
        bb = extract("battery_box_id")
        if bb:
            updates["battery_box_id"] = bb

        # Motor ID — strip leading "{bike_no}-" prefix if present
        motor = extract("motor_id")
        if motor:
            prefix = f"{bike_no}-"
            if motor.startswith(prefix):
                motor = motor[len(prefix):]
            updates["motor_id"] = motor

        # Modules & BMS
        for field in ("left_module_id", "right_module_id", "bms_id"):
            val = extract(field)
            if val:
                updates[field] = val

        if updates:
            registry[bike_id].update(updates)
            updated_count += 1

    save_bike_registry(registry)
    return True, f"Successfully merged {updated_count} bike record(s).", updated_count


def update_bike_info(bike_id, new_data):
    """Updates a specific bike's metadata via API calls."""
    registry = load_bike_registry()
    if bike_id in registry:
        registry[bike_id].update(new_data)
        save_bike_registry(registry)
        return True
    return False

# Self-execute sync on backend script load
ingest_csv_to_registry()


class BikeDBManager:
    """Simple wrapper exposing bike registry operations for FastAPI."""
    def __init__(self):
        pass
    def list_all(self):
        """Return the full bike registry as a dict/list."""
        return load_bike_registry()
