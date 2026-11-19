"""
BazarBondhu AI — Canonical ID Mapping Layer (Audited Stage 4.7.1)
================================================================

Provides safe, audited bidirectional mapping between Frontend mock identifiers
(from Frontend/src/mock/data.ts) and the authoritative canonical CSV / database
identifiers stored in SQLite (bazarbondhu.db).

Audit Invariants (Stage 4.7.1):
1. Exact Matches Only: Mappings are established ONLY when product identity,
   commodity specification, and units of measurement are identical.
2. No Silent Coercion: Products with brand mismatches, packaging/size mismatches,
   or unit discrepancies (e.g. 'kg' vs 'packet') are strictly mapped to None.
3. Pass-Through for Canonical IDs: Canonical IDs (e.g. 'OUT001', 'PRD001') pass
   through directly without alteration.
4. Total Mock Products Audited: 27
   - Verified Exact Mappings: 9
   - Ambiguous / Mismatched Identity or Unit: 9 (Strictly Rejected -> None)
   - Missing Counterpart in Catalog: 9 (Strictly Rejected -> None)
"""

from typing import Optional, Dict, Set, Tuple


# -----------------------------------------------------------------------------
# Shop / Outlet Mappings
# -----------------------------------------------------------------------------

# Explicit map: Frontend mock shop ID -> Canonical outlet ID (outlets table)
FRONTEND_TO_CANONICAL_SHOP: Dict[str, str] = {
    "shop-student-01": "OUT001",   # 9/A Dhanmondi (Student/University residential context)
    "shop-garment-01": "OUT003",   # Mirpur-10 Branch (Garment / industrial worker context)
    "shop-affluent-01": "OUT002",  # Gulshan-2 Branch (Premium / affluent residential context)
}

# Reverse map: Canonical outlet ID -> Frontend mock shop ID
CANONICAL_TO_FRONTEND_SHOP: Dict[str, str] = {
    v: k for k, v in FRONTEND_TO_CANONICAL_SHOP.items()
}


# -----------------------------------------------------------------------------
# Audited Product Mappings (All 27 Frontend Mock Products)
# -----------------------------------------------------------------------------

FRONTEND_TO_CANONICAL_PRODUCT: Dict[str, Optional[str]] = {
    # ── Shop 1: Student / Mirpur (9 products) ─────────────────────────────────
    "prod-s1-rice-mini": "PRD001",       # EXACT: Miniket rice / মিনিকেট চাল (1 kg)
    "prod-s1-soybean": "PRD006",         # EXACT: Soybean oil / সয়াবিন তেল (1 litre)
    "prod-s1-milk-powder": None,         # UNMAPPED: 55 BDT sachet vs 480 BDT 500g bulk pack (PRD015) - size/valuation mismatch
    "prod-s1-turmeric": "PRD012",        # EXACT: Turmeric powder / হলুদ গুঁড়া (1 packet)
    "prod-s1-tea": None,                 # UNMAPPED: Ispahani branded tea packet vs Nestlé generic Black tea 200g (PRD030) - unverified brand counterpart
    "prod-s1-biscuit": None,             # UNMAPPED: Tiger glucose biscuit vs Marie tea biscuit (PRD025) - product identity & unit mismatch
    "prod-s1-potato": "PRD019",          # EXACT: Potato / আলু (1 kg, exact 38 BDT price match)
    "prod-s1-soap": None,                # UNMAPPED: Lux branded soap bar vs ACI generic Bathing soap (PRD036) - unverified brand counterpart
    "prod-s1-lentil": "PRD004",          # EXACT: Masoor dal / মসুর ডাল (1 kg red lentil)

    # ── Shop 2: Garment Worker / Mirpur (9 products) ──────────────────────────
    "prod-s2-coarse-rice": "PRD003",     # EXACT: Coarse rice / মোটা চাল (1 kg Paijam coarse rice)
    "prod-s2-palm-oil": None,            # UNMAPPED: No palm oil commodity in canonical catalog
    "prod-s2-fresh-milk": None,          # UNMAPPED: Raw fresh cow milk vs chilled pasteurized pouch (PRD014) - processing/identity mismatch
    "prod-s2-chili": "PRD013",           # EXACT: Chilli powder / মরিচ গুঁড়া (1 packet)
    "prod-s2-tea-loose": None,           # UNMAPPED: Loose tea sold by weight (kg) vs 200g foil packet (PRD030) - unit & packaging mismatch
    "prod-s2-chanachur": None,           # UNMAPPED: No chanachur commodity in canonical catalog
    "prod-s2-onion": "PRD020",           # EXACT: Onion / পেঁয়াজ (1 kg)
    "prod-s2-detergent": None,           # UNMAPPED: Wheel branded detergent vs Bashundhara generic detergent powder (PRD035) - unverified brand counterpart
    "prod-s2-mustard-oil": "PRD007",     # EXACT: Mustard oil / সরিষার তেল (1 litre)

    # ── Shop 3: Affluent / Gulshan (9 products) ──────────────────────────────
    "prod-s3-basmati": None,             # UNMAPPED: No basmati rice in canonical catalog (only Miniket, Nazirshail, Coarse)
    "prod-s3-olive-oil": None,           # UNMAPPED: No olive oil in canonical catalog (only Soybean and Mustard oil)
    "prod-s3-uht-milk": None,            # UNMAPPED: Ambient shelf-stable UHT milk vs chilled pasteurized pouch (PRD014) - storage/identity mismatch
    "prod-s3-saffron": None,             # UNMAPPED: No saffron commodity in canonical catalog
    "prod-s3-green-tea": None,           # UNMAPPED: No green tea commodity in canonical catalog
    "prod-s3-granola": None,             # UNMAPPED: No granola commodity in canonical catalog
    "prod-s3-broccoli": None,            # UNMAPPED: No broccoli commodity in canonical catalog
    "prod-s3-dishwasher": None,          # UNMAPPED: 1L refill (litre) vs 500ml standard bottle (PRD034) - unit & volume mismatch
    "prod-s3-yogurt": None,              # UNMAPPED: No yogurt commodity in canonical catalog
}

# Reverse map: Canonical product ID -> Primary frontend mock product ID
CANONICAL_TO_FRONTEND_PRODUCT: Dict[str, str] = {
    v: k for k, v in FRONTEND_TO_CANONICAL_PRODUCT.items() if v is not None
}

# Audit classifications for diagnostic reporting
EXACT_VERIFIED_MAPPINGS: Set[str] = {
    k for k, v in FRONTEND_TO_CANONICAL_PRODUCT.items() if v is not None
}

AMBIGUOUS_MISMATCHED_MAPPINGS: Set[str] = {
    "prod-s1-milk-powder",   # Size/value mismatch (55 BDT sachet vs 480 BDT 500g bulk pack)
    "prod-s1-tea",           # Unverified brand counterpart (Ispahani vs Nestlé PRD030)
    "prod-s1-biscuit",       # Identity & unit mismatch (Tiger glucose pcs vs Marie packet PRD025)
    "prod-s1-soap",          # Unverified brand counterpart (Lux vs ACI PRD036)
    "prod-s2-fresh-milk",    # Identity & processing mismatch (Raw cow milk vs Pasteurized PRD014)
    "prod-s2-tea-loose",     # Unit & packaging mismatch (kg loose vs 200g packet PRD030)
    "prod-s2-detergent",     # Unverified brand counterpart (Wheel vs Bashundhara PRD035)
    "prod-s3-uht-milk",      # Identity & storage mismatch (Ambient UHT vs Chilled pasteurized PRD014)
    "prod-s3-dishwasher",    # Unit & volume mismatch (litre vs 500ml bottle PRD034)
}

MISSING_COUNTERPART_MAPPINGS: Set[str] = {
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


# -----------------------------------------------------------------------------
# Mapping Resolution Functions
# -----------------------------------------------------------------------------

def resolve_canonical_shop(identifier: str) -> Optional[str]:
    """
    Safely resolves any shop identifier to its canonical outlet ID (e.g. 'OUT001').

    Rules:
    - If identifier matches a frontend mock shop ID, returns the mapped canonical ID.
    - If identifier is already canonical (e.g. 'OUT001'), passes through.
    - Otherwise returns None. Never guesses.
    """
    clean_id = str(identifier).strip()
    if clean_id in FRONTEND_TO_CANONICAL_SHOP:
        return FRONTEND_TO_CANONICAL_SHOP[clean_id]
    if clean_id.startswith("OUT") and len(clean_id) >= 6:
        return clean_id
    return None


def resolve_canonical_product(identifier: str) -> Optional[str]:
    """
    Safely resolves any product identifier to its canonical product ID (e.g. 'PRD001').

    Rules:
    - If identifier is an exact verified mock product, returns the canonical ID.
    - If identifier is an unmapped mock product (mapped to None), strictly returns None.
    - If identifier is already canonical (e.g. 'PRD001'), passes through.
    - Otherwise returns None. Never fabricates or coerces.
    """
    clean_id = str(identifier).strip()
    if clean_id in FRONTEND_TO_CANONICAL_PRODUCT:
        return FRONTEND_TO_CANONICAL_PRODUCT[clean_id]
    if clean_id.startswith("PRD") and len(clean_id) >= 6:
        return clean_id
    return None


def resolve_frontend_shop(canonical_id: str) -> Optional[str]:
    """Resolves a canonical outlet ID to its frontend mock shop ID if one exists."""
    return CANONICAL_TO_FRONTEND_SHOP.get(str(canonical_id).strip(), None)


def resolve_frontend_product(canonical_id: str) -> Optional[str]:
    """Resolves a canonical product ID to its frontend mock product ID if one exists."""
    return CANONICAL_TO_FRONTEND_PRODUCT.get(str(canonical_id).strip(), None)


def get_mapping_statistics() -> Dict[str, int]:
    """Returns audited coverage statistics of the mapping layer."""
    total_mock_products = len(FRONTEND_TO_CANONICAL_PRODUCT)
    exact_mapped = len(EXACT_VERIFIED_MAPPINGS)
    ambiguous_unmapped = len(AMBIGUOUS_MISMATCHED_MAPPINGS)
    missing_unmapped = len(MISSING_COUNTERPART_MAPPINGS)

    return {
        "mock_shops_total": len(FRONTEND_TO_CANONICAL_SHOP),
        "mock_shops_mapped": len(FRONTEND_TO_CANONICAL_SHOP),
        "mock_products_total": total_mock_products,
        "mock_products_exact_verified": exact_mapped,
        "mock_products_ambiguous_mismatched": ambiguous_unmapped,
        "mock_products_missing_counterpart": missing_unmapped,
        "mock_products_total_unmapped": ambiguous_unmapped + missing_unmapped,
    }
