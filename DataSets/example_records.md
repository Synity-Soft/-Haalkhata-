## outlets.csv
```csv
outlet_id,outlet_name,outlet_type,business_size,division,district,city,neighbourhood,area_type,socioeconomic_segment,estimated_customer_profile,average_daily_customers,average_transaction_value_bdt,average_monthly_revenue_bdt,approximate_latitude,approximate_longitude,operating_hours,opening_days,inventory_capacity_sku,average_restock_frequency_days,supplier_count,has_refrigeration,has_pos_system,inventory_management_method,established_year,area_id
OUT001,Nobo Bazar 001,Grocery store,Medium,Dhaka,Dhaka,Dhaka,Banani,Premium / affluent residential,High,Premium; affluent residential,396,589.03,6410821.79,23.777465,90.366106,09:00-23:00,6-7 days,1200,8,6,True,False,Manual ledger,2011,AR001
OUT002,Shapla Bazar 002,Grocery store,Medium,Mymensingh,Mymensingh,Mymensingh,Banani,Premium / affluent residential,High,Premium; affluent residential,441,364.42,5069713.48,24.755649,90.427713,09:00-23:00,6-7 days,1200,8,7,True,True,POS software,2007,AR002
OUT003,Bazar Grocery 003,Supermarket,Large supermarket,Dhaka,Dhaka,Dhaka,Uttara Sector 4,Premium / affluent residential,High,Premium; affluent residential,1201,961.82,36702265.1,23.788679,90.380006,09:00-23:00,6-7 days,4500,12,4,True,True,Manual ledger,2022,AR003
```

## area_profiles.csv
```csv
area_id,division,district,neighbourhood,area_type,income_segment,population_density,dominant_customer_groups,student_population_level,garment_worker_population_level,office_worker_population_level,family_population_level,market_activity_level,tourism_activity_level,price_sensitivity,preferred_product_categories,average_shopping_frequency,payday_effect_level,seasonal_demand_sensitivity
AR001,Dhaka,Dhaka,Banani,Premium / affluent residential,High,High,Premium; affluent residential,Low,Low,Low,Medium,Medium,Low,Low,,Weekly,Medium,High
AR002,Mymensingh,Mymensingh,Banani,Premium / affluent residential,High,High,Premium; affluent residential,Low,Low,Low,Medium,Very High,Low,Low,,Daily,High,High
AR003,Dhaka,Dhaka,Uttara Sector 4,Premium / affluent residential,High,High,Premium; affluent residential,Low,Low,Low,Medium,Very High,Low,Low,,2-3 times weekly,High,High
```

## products.csv
```csv
product_id,product_name,product_name_bn,category,subcategory,brand,unit,package_size,perishable_status,typical_shelf_life_days,storage_type,average_cost_price_bdt,average_selling_price_bdt,minimum_margin_percentage,demand_volatility,seasonal_sensitivity,product_popularity,is_essential_item
PRD001,Miniket rice,মিনিকেট চাল,Rice and grains,Rice,Unbranded,kg,1 kg,Non-perishable,365,Ambient,72.0,82.0,12.2,High,Medium,Low,True
PRD002,Nazirshail rice,নাজিরশাইল চাল,Rice and grains,Rice,Local brand,kg,1 kg,Non-perishable,365,Ambient,78.0,90.0,13.33,High,High,High,True
PRD003,Coarse rice,মোটা চাল,Rice and grains,Rice,Rupchanda,kg,1 kg,Non-perishable,365,Ambient,48.0,56.0,14.29,High,Medium,High,True
```

## outlet_products.csv
```csv
outlet_product_id,outlet_id,product_id,selling_price_bdt,purchase_cost_bdt,minimum_stock_level,maximum_stock_level,reorder_point,average_daily_demand,demand_variability,preferred_supplier_id,is_active
OP000001,OUT001,PRD047,73.22,63.07,1,16,2,0.835,0.227,SUP070,True
OP000002,OUT001,PRD217,38.78,28.08,1,5,2,0.363,0.396,SUP040,True
OP000003,OUT001,PRD213,497.16,346.04,2,13,2,1.079,0.152,SUP005,True
```

## suppliers.csv
```csv
supplier_id,supplier_name,supplier_type,division,district,operating_area,product_categories_supplied,average_delivery_time_days,minimum_order_value_bdt,reliability_score,payment_terms,contact_type
SUP001,Eastern Wholesale 001,Local agricultural supplier,Barishal,Barishal,Barishal and nearby markets,Eggs;Meat and poultry;Flour and baking ingredients;Instant noodles and packaged food;Beverages and bottled water,2,20000,0.85,15 days,Fictional business contact
SUP002,Sunrise Trading 002,Regional supplier,Chattogram,Chattogram,Chattogram and nearby markets,Flour and baking ingredients;Meat and poultry;Tea and coffee;Vegetables;Fish and frozen foods,5,5000,0.86,15 days,Fictional business contact
SUP003,Green Distribution 003,Direct brand supplier,Rajshahi,Rajshahi,Rajshahi and nearby markets,Basic health and hygiene products;Fish and frozen foods;Dairy products;Beverages and bottled water;Cooking oil,3,10000,0.98,7 days,Fictional business contact
```

## outlet_suppliers.csv
```csv
outlet_supplier_id,outlet_id,supplier_id,relationship_start_date,preferred_supplier,average_delivery_time_days,supplier_price_level,payment_method,supplier_reliability_score
OS00001,OUT001,SUP104,2020-07-14,True,4,Low,Cash,0.8
OS00002,OUT001,SUP112,2022-04-01,False,5,Low,Cash,0.81
OS00003,OUT001,SUP070,2020-08-22,False,2,Medium,Mobile financial service,0.94
```

## inventory_batches.csv
```csv
batch_id,outlet_id,product_id,supplier_id,batch_received_date,manufacturing_date,expiry_date,initial_quantity,remaining_quantity,purchase_cost_per_unit_bdt,selling_price_per_unit_bdt,storage_condition,batch_status
BAT0000001Q1,OUT001,PRD047,SUP070,2025-11-16,2025-11-15,2026-05-14,84,23,63.48,73.22,Ambient,Expired
BAT0000001Q2,OUT001,PRD047,SUP070,2026-02-16,2026-02-14,2026-08-13,88,22,61.54,73.22,Ambient,Expired
BAT0000001Q3,OUT001,PRD047,SUP070,2026-05-18,2026-05-17,2026-11-13,112,47,64.77,73.22,Ambient,Expired
```

## sales.csv
```csv
sale_id,transaction_id,outlet_id,product_id,batch_id,sale_date,sale_time,quantity_sold,unit_selling_price_bdt,unit_cost_price_bdt,discount_percentage,total_sales_bdt,total_cost_bdt,payment_method,customer_segment
SALE000000001,TX000000001,OUT001,PRD047,BAT0000001Q1,2025-11-16,21:34:00,3,71.76,63.48,2.0,215.28,190.43,Cash,Student
SALE000000002,TX000000002,OUT001,PRD047,BAT0000001Q1,2025-11-20,09:56:00,5,71.76,63.48,2.0,358.8,317.38,Card,Office worker
SALE000000003,TX000000003,OUT001,PRD047,BAT0000001Q1,2025-11-24,08:08:00,3,73.22,63.48,0.0,219.66,190.43,Mobile financial service,Other
```

## daily_outlet_metrics.csv
```csv
metric_id,outlet_id,date,total_transactions,total_units_sold,total_revenue_bdt,total_discount_bdt,estimated_gross_profit_bdt,unique_products_sold,average_transaction_value_bdt,customer_count_estimate
MET00000001,OUT001,2025-11-16,20,93,18430.54,279.32,2903.09,20,921.53,18.0
MET00000002,OUT001,2025-11-17,17,87,20700.89,163.32,3036.09,17,1217.7,15.0
MET00000003,OUT001,2025-11-18,17,73,17920.89,62.21,3398.75,17,1054.17,15.0
```

## purchase_orders.csv
```csv
purchase_order_id,outlet_id,supplier_id,order_date,expected_delivery_date,actual_delivery_date,order_status,total_order_value_bdt,payment_status
PO000001,OUT001,SUP070,2025-11-14,2025-11-16,2025-11-16,Received,1149525.36,Paid
PO000002,OUT001,SUP070,2025-12-15,2025-12-17,2025-12-17,Received,1124003.08,Paid
PO000003,OUT001,SUP070,2026-01-15,2026-01-17,2026-01-17,Received,1150875.09,Paid
```

## purchase_order_items.csv
```csv
purchase_order_item_id,purchase_order_id,product_id,quantity_ordered,quantity_received,unit_purchase_price_bdt,line_total_bdt
POI00000001,PO000001,PRD047,84,84,63.48,5332.32
POI00000002,PO000001,PRD217,46,46,27.32,1256.72
POI00000003,PO000001,PRD213,48,48,343.55,16490.4
```

## wastage_records.csv
```csv
wastage_id,outlet_id,product_id,batch_id,wastage_date,wasted_quantity,wastage_reason,unit_cost_bdt,total_wastage_value_bdt
WST0000001,OUT001,PRD161,BAT0000008Q4,2026-11-15,6,Unsold seasonal stock,92.49,554.91
WST0000002,OUT001,PRD011,BAT0000009Q1,2026-02-15,2,Unsold seasonal stock,32.38,64.77
WST0000003,OUT001,PRD150,BAT0000017Q2,2026-05-17,1,Unsold seasonal stock,48.08,48.08
```

## promotions_discounts.csv
```csv
promotion_id,outlet_id,product_id,batch_id,start_date,end_date,original_price_bdt,discounted_price_bdt,discount_percentage,promotion_reason,units_sold_during_promotion,estimated_revenue_bdt
PROM00001,OUT157,PRD092,BAT0010411Q3,2026-01-17,2026-01-17,14.88,14.14,5.0,Volume promotion,4,56.54
PROM00002,OUT053,PRD027,BAT0004241Q4,2026-08-17,2026-08-17,25.0,21.25,15.0,Volume promotion,2,42.5
PROM00003,OUT133,PRD221,BAT0008610Q1,2025-11-16,2025-11-16,458.88,390.05,15.0,Expiry-driven discount,2,780.1
```

## calendar_events.csv
```csv
event_id,event_name,event_type,start_date,end_date,affected_product_categories,expected_demand_effect,effect_description
EV01,Winter season,Seasonal,2025-12-01,2026-02-28,Vegetables;Fruits;Beverages,Mixed,Synthetic seasonal window
EV02,Ramadan,Religious,2026-02-18,2026-03-19,Rice and grains;Lentils and pulses;Cooking oil;Beverages,Increase,Illustrative lunar window; confirm actual moon-sighting dates
EV03,Eid-ul-Fitr,Religious,2026-03-19,2026-03-23,Dairy products;Beverages;Biscuits and snacks;Meat and poultry,Increase,Bangladesh 2026 holiday calendar; moon-sighting dependent
```

