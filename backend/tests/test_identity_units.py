import re

import pytest

from services.identity import PATIENT_CODE_RE, generate_patient_code, normalize_phone


def test_generated_patient_codes_are_human_readable_and_unique():
    codes = {generate_patient_code() for _ in range(500)}
    assert len(codes) == 500
    assert all(PATIENT_CODE_RE.fullmatch(code) for code in codes)
    assert all(not re.search(r"[ILO0]", code) for code in codes)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("98765 43210", "+919876543210"),
        ("+91-98765-43210", "+919876543210"),
        ("09876543210", "+919876543210"),
        ("0091 98765 43210", "+919876543210"),
    ],
)
def test_phone_normalization(raw, expected):
    assert normalize_phone(raw) == expected


def test_invalid_phone_is_rejected():
    with pytest.raises(ValueError):
        normalize_phone("123")