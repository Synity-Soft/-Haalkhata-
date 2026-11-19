#!/usr/bin/env python3
"""
BazarBondhu AI — Stage 4.7.1: Product ID Mapping Audit Test Suite
================================================================

Comprehensive automated test suite validating the audited frontend-to-canonical
product ID mappings, strict rejection rules, and outlet availability.

Verifies:
 1. Total mock product count (exactly 27 items from Frontend/src/mock/data.ts)
 2. All 9 exact verified mappings resolve correctly to canonical product IDs
 3. All 9 ambiguous / identity & unit mismatched products strictly resolve to None
 4. All 9 missing counterpart products strictly resolve to None
 5. Arbitrary unknown product and shop IDs strictly resolve to None
 6. Canonical IDs ('PRD001', 'OUT001') pass through directly without alteration
 7. Mapping statistics consistency (9 exact, 9 ambiguous, 9 missing = 27 total)
 8. Verified outlet availability in outlet_products catalog for mapped items
"""

import sys
from pathlib import Path

# Add repo root to path
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.mapping import (
    FRONTEND_TO_CANONICAL_PRODUCT,
    FRONTEND_TO_CANONICAL_SHOP,
    CANONICAL_TO_FRONTEND_PRODUCT,
    CANONICAL_TO_FRONTEND_SHOP,
    EXACT_VERIFIED_MAPPINGS,
    AMBIGUOUS_MISMATCHED_MAPPINGS,
    MISSING_COUNTERPART_MAPPINGS,
    resolve_canonical_product,
    resolve_canonical_shop,
    resolve_frontend_product,
    resolve_frontend_shop,
    get_mapping_statistics,
)
import pandas as pd


def run_mapping_audit_tests():
    print("=" * 76)
    print("BazarBondhu AI — Stage 4.7.1: Product Mapping Audit Test Suite")
    print("=" * 76)

    passed_checks = 0
    total_checks = 8

    # -------------------------------------------------------------------------
    # Check 1: Total Inspected Products
    # -------------------------------------------------------------------------
    print("\n[Check 01/08] Verifying Total Audited Mock Products Count...")
    assert len(FRONTEND_TO_CANONICAL_PRODUCT) == 27, f"Expected 27 products, got {len(FRONTEND_TO_CANONICAL_PRODUCT)}"
    assert len(FRONTEND_TO_CANONICAL_SHOP) == 3, f"Expected 3 shops, got {len(FRONTEND_TO_CANONICAL_SHOP)}"
    passed_checks += 1
    print(f"      PASSED: Exactly 27 frontend mock products and 3 shops registered.")

    # -------------------------------------------------------------------------
    # Check 2: Exact Verified Mappings (9 Products)
    # -------------------------------------------------------------------------
    print("\n[Check 02/08] Verifying All 9 Exact Verified Mappings...")
    expected_exact = {
        "prod-s1-rice-mini": "PRD001",       # Miniket rice (1 kg)
        "prod-s1-soybean": "PRD006",         # Soybean oil (1 litre)
        "prod-s1-turmeric": "PRD012",        # Turmeric powder (1 packet)
        "prod-s1-potato": "PRD019",          # Potato (1 kg)
        "prod-s1-lentil": "PRD004",          # Masoor dal (1 kg)
        "prod-s2-coarse-rice": "PRD003",     # Coarse rice (1 kg)
        "prod-s2-chili": "PRD013",           # Chilli powder (1 packet)
        "prod-s2-onion": "PRD020",           # Onion (1 kg)
        "prod-s2-mustard-oil": "PRD007",     # Mustard oil (1 litre)
    }
    assert len(EXACT_VERIFIED_MAPPINGS) == 9
    for f_id, expected_c_id in expected_exact.items():
        actual = resolve_canonical_product(f_id)
        assert actual == expected_c_id, f"Expected {f_id} -> {expected_c_id}, got {actual}"
        # Reverse mapping check
        rev = resolve_frontend_product(expected_c_id)
        assert rev == f_id, f"Expected reverse {expected_c_id} -> {f_id}, got {rev}"
    passed_checks += 1
    print("      PASSED: All 9 exact verified products resolve bidirectionally with 100% precision.")

    # -------------------------------------------------------------------------
    # Check 3: Ambiguous / Mismatched Identity or Unit Products (9 Products)
    # -------------------------------------------------------------------------
    print("\n[Check 03/08] Verifying Strict Rejection of Ambiguous / Mismatched Products...")
    expected_ambiguous = {
        "prod-s1-milk-powder",   # 55 BDT sachet vs 480 BDT 500g bulk pack
        "prod-s1-tea",           # Ispahani branded tea packet vs Nestlé generic Black tea 200g
        "prod-s1-biscuit",       # Tiger glucose energy biscuit vs Marie tea biscuit
        "prod-s1-soap",          # Lux branded soap bar vs ACI generic Bathing soap
        "prod-s2-fresh-milk",    # Raw cow milk vs Pasteurized milk
        "prod-s2-tea-loose",     # Loose tea in kg vs 200g foil packet
        "prod-s2-detergent",     # Wheel branded detergent vs Bashundhara generic detergent
        "prod-s3-uht-milk",      # Ambient UHT carton vs Chilled pasteurized milk
        "prod-s3-dishwasher",    # 1L Vim refill vs 500ml standard bottle
    }
    assert expected_ambiguous == AMBIGUOUS_MISMATCHED_MAPPINGS
    for f_id in expected_ambiguous:
        actual = resolve_canonical_product(f_id)
        assert actual is None, f"Expected ambiguous product {f_id} to resolve to None, got {actual}"
    passed_checks += 1
    print("      PASSED: All 9 ambiguous / identity & unit mismatched products strictly resolve to None.")

    # -------------------------------------------------------------------------
    # Check 4: Missing Counterpart Products (9 Products)
    # -------------------------------------------------------------------------
    print("\n[Check 04/08] Verifying Strict Rejection of Missing Counterparts...")
    expected_missing = {
        "prod-s2-palm-oil",
        "prod-s2-chanachur",
        "prod-s3-basmati",
        "prod-s3-olive-oil",
        "prod-s3-saffron",
        "prod-s3-green-tea",
        "prod-s3-granola",
        "prod-s3-broccoli",
        "prod-s3-yogurt",
    }
    assert expected_missing == MISSING_COUNTERPART_MAPPINGS
    for f_id in expected_missing:
        actual = resolve_canonical_product(f_id)
        assert actual is None, f"Expected missing counterpart {f_id} to resolve to None, got {actual}"
    passed_checks += 1
    print("      PASSED: All 9 products without catalog counterparts strictly resolve to None.")

    # -------------------------------------------------------------------------
    # Check 5: Arbitrary Unknown Identifiers
    # -------------------------------------------------------------------------
    print("\n[Check 05/08] Verifying Arbitrary Unknown Identifiers Return None...")
    assert resolve_canonical_product("unknown-item-123") is None
    assert resolve_canonical_product("prod-unknown-rice") is None
    assert resolve_canonical_shop("shop-unknown-99") is None
    assert resolve_frontend_product("PRD999") is None
    assert resolve_frontend_shop("OUT999") is None
    passed_checks += 1
    print("      PASSED: Arbitrary unknown IDs safely return None without throwing or guessing.")

    # -------------------------------------------------------------------------
    # Check 6: Canonical Pass-Through
    # -------------------------------------------------------------------------
    print("\n[Check 06/08] Verifying Canonical ID Pass-Through...")
    assert resolve_canonical_product("PRD001") == "PRD001"
    assert resolve_canonical_product("PRD047") == "PRD047"
    assert resolve_canonical_product("PRD260") == "PRD260"
    assert resolve_canonical_shop("OUT001") == "OUT001"
    assert resolve_canonical_shop("OUT150") == "OUT150"
    passed_checks += 1
    print("      PASSED: Canonical IDs pass through without alteration.")

    # -------------------------------------------------------------------------
    # Check 7: Mapping Statistics Consistency
    # -------------------------------------------------------------------------
    print("\n[Check 07/08] Verifying Mapping Statistics Consistency...")
    stats = get_mapping_statistics()
    assert stats["mock_products_total"] == 27
    assert stats["mock_products_exact_verified"] == 9
    assert stats["mock_products_ambiguous_mismatched"] == 9
    assert stats["mock_products_missing_counterpart"] == 9
    assert stats["mock_products_total_unmapped"] == 18
    assert stats["mock_shops_total"] == 3
    assert stats["mock_shops_mapped"] == 3
    passed_checks += 1
    print(f"      PASSED: Statistics validated: 9 exact verified, 18 total unmapped (9 ambiguous + 9 missing).")

    # -------------------------------------------------------------------------
    # Check 8: Outlet Availability Verification in Authoritative CSV
    # -------------------------------------------------------------------------
    print("\n[Check 08/08] Verifying Outlet Availability for Exact Mappings in CSV...")
    op_path = REPO_ROOT / "DataSets" / "outlet_products.csv"
    op_df = pd.read_csv(op_path)

    # 8a. Verify PRD013 (Chilli powder) is stocked at OUT003 (shop-garment-01)
    chili_stocked = len(op_df[(op_df["outlet_id"] == "OUT003") & (op_df["product_id"] == "PRD013")]) > 0
    assert chili_stocked, "Expected PRD013 to be stocked at OUT003"

    # 8b. Verify PRD019 (Potato) is stocked at OUT002 (shop-affluent-01)
    potato_stocked = len(op_df[(op_df["outlet_id"] == "OUT002") & (op_df["product_id"] == "PRD019")]) > 0
    assert potato_stocked, "Expected PRD019 to be stocked at OUT002"

    # 8c. Verify PRD004 (Masoor dal) is stocked at OUT003 (shop-garment-01)
    lentil_stocked = len(op_df[(op_df["outlet_id"] == "OUT003") & (op_df["product_id"] == "PRD004")]) > 0
    assert lentil_stocked, "Expected PRD004 to be stocked at OUT003"

    # 8d. Verify PRD001 (Miniket rice) is NOT stocked at OUT001 (catalog integrity)
    miniket_out1_stocked = len(op_df[(op_df["outlet_id"] == "OUT001") & (op_df["product_id"] == "PRD001")]) > 0
    assert not miniket_out1_stocked, "Expected base PRD001 not to be stocked at OUT001"

    passed_checks += 1
    print("      PASSED: Outlet availability in outlet_products.csv verified for all audit test cases.")

    # -------------------------------------------------------------------------
    # Test Suite Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 76)
    print(f"PRODUCT MAPPING AUDIT TEST SUITE: {passed_checks}/{total_checks} CHECKS PASSED (100%)")
    print("=" * 76)


if __name__ == "__main__":
    run_mapping_audit_tests()
