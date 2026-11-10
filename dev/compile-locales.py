#!/usr/bin/env python3
"""
Compile .po files to GNU MO binary format without requiring external gettext tools.
Usage:
    python3 dev/compile-locales.py [po_file] [mo_file]
    python3 dev/compile-locales.py --all
"""

import os
import sys
import struct
import re

def parse_po(file_path):
    """Parses a .po file and returns a dictionary of {msgid: msgstr}."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    entries = {}
    
    # State-based parser for PO format
    current_msgid = None
    current_msgstr = None
    state = None # 'msgid', 'msgstr'

    def unescape(s):
        return s.encode('utf-8').decode('unicode_escape')

    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        if line.startswith('msgid '):
            if current_msgid is not None and current_msgstr is not None:
                entries[current_msgid] = current_msgstr
            current_msgid = line[6:].strip().strip('"')
            current_msgstr = None
            state = 'msgid'
        elif line.startswith('msgstr '):
            current_msgstr = line[7:].strip().strip('"')
            state = 'msgstr'
        elif line.startswith('"') and line.endswith('"'):
            inner = line[1:-1]
            if state == 'msgid':
                current_msgid += inner
            elif state == 'msgstr':
                current_msgstr += inner

    if current_msgid is not None and current_msgstr is not None:
        entries[current_msgid] = current_msgstr

    # Process escapes like \n, \", etc.
    cleaned = {}
    for k, v in entries.items():
        k_clean = k.replace('\\n', '\n').replace('\\"', '"').replace('\\t', '\t')
        v_clean = v.replace('\\n', '\n').replace('\\"', '"').replace('\\t', '\t')
        cleaned[k_clean] = v_clean

    return cleaned

def generate_mo(catalog):
    """Compiles a catalog dict {msgid: msgstr} into GNU MO binary bytes."""
    # Omit empty msgids except header if needed, but standard GNU MO includes msgid="" as metadata header
    keys = sorted(catalog.keys())
    count = len(keys)
    magic = 0x950412de
    version = 0

    orig_table_offset = 28
    trans_table_offset = orig_table_offset + count * 8
    strings_offset = trans_table_offset + count * 8

    orig_table = []
    trans_table = []
    strings_data = bytearray()

    for k in keys:
        k_bytes = k.encode('utf-8') + b'\x00'
        orig_table.append((len(k_bytes) - 1, strings_offset + len(strings_data)))
        strings_data.extend(k_bytes)

    for k in keys:
        v_bytes = catalog[k].encode('utf-8') + b'\x00'
        trans_table.append((len(v_bytes) - 1, strings_offset + len(strings_data)))
        strings_data.extend(v_bytes)

    header = struct.pack(
        'Iiiiiii',
        magic,
        version,
        count,
        orig_table_offset,
        trans_table_offset,
        0, 0
    )

    buf = bytearray(header)
    for length, offset in orig_table:
        buf.extend(struct.pack('ii', length, offset))
    for length, offset in trans_table:
        buf.extend(struct.pack('ii', length, offset))
    buf.extend(strings_data)
    return bytes(buf)

def compile_po_to_mo(po_path, mo_path):
    entries = parse_po(po_path)
    mo_bytes = generate_mo(entries)
    os.makedirs(os.path.dirname(mo_path), exist_ok=True)
    with open(mo_path, 'wb') as f:
        f.write(mo_bytes)
    print(f"Compiled {po_path} -> {mo_path} ({len(entries)} strings)")

def compile_all():
    po_dir = 'po'
    if not os.path.isdir(po_dir):
        print("No po/ directory found.")
        return
    for fname in os.listdir(po_dir):
        if fname.endswith('.po'):
            lang = fname[:-3]
            po_path = os.path.join(po_dir, fname)
            mo_path = os.path.join('locale', lang, 'LC_MESSAGES', 'spotify-ext.mo')
            compile_po_to_mo(po_path, mo_path)

if __name__ == '__main__':
    if len(sys.argv) == 3:
        compile_po_to_mo(sys.argv[1], sys.argv[2])
    elif len(sys.argv) <= 2:
        compile_all()
