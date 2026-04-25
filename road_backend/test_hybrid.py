from thermal_ride import ThermalRide

ride = ThermalRide('Raw_Data/15_04_2026_BK-04_Route-Road_Route-Road.xlsx')
ride.ingest().sync().compute_features().compute_ride_metrics()
m = ride.ride_metrics
print(f'Drive Score: {m["Drive_Score"]}')
print(f'Penalty_Throttle: {m.get("Penalty_Throttle", 0):.1f}')
print(f'Penalty_Velocity: {m.get("Penalty_Velocity", 0):.1f}')
print(f'Penalty_Regen: {m.get("Penalty_Regen", 0):.1f}')
print(f'Penalty_Brake: {m.get("Penalty_Brake", 0):.1f}')
print(f'Brake_Switch_Count: {m.get("Brake_Switch_Count", 0)}')