import os
import json
import pandas as pd

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
