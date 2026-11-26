"""Normalize the browser's raster export and identify downloadable apartment plans."""
import re
import struct
import zlib

MAX_BYTES = 8 * 1024 * 1024
MAX_SIDE = 2400
PNG = b'\x89PNG\r\n\x1a\n'


def clean_png(data):
    """Keep only pixel data from an 8-bit RGB/RGBA canvas PNG."""
    if not data.startswith(PNG):
        raise ValueError
    pos = len(PNG)
    header = None
    compressed = bytearray()
    output = bytearray(PNG)
    while pos + 12 <= len(data):
        size, kind = struct.unpack_from('>I4s', data, pos)
        end = pos + 12 + size
        if end > len(data):
            raise ValueError
        payload = memoryview(data)[pos + 8:end - 4]
        if struct.unpack_from('>I', data, end - 4)[0] != zlib.crc32(payload, zlib.crc32(kind)):
            raise ValueError
        if kind == b'IHDR':
            if pos != len(PNG) or size != 13:
                raise ValueError
            width, height, bits, color, compression, filters, interlace = struct.unpack('>IIBBBBB', payload)
            if not (0 < width <= MAX_SIDE and 0 < height <= MAX_SIDE and bits == 8
                    and color in (2, 6) and (compression, filters, interlace) == (0, 0, 0)):
                raise ValueError
            header = (height, 1 + width * (3 if color == 2 else 4))
        elif header is None:
            raise ValueError
        elif kind == b'IDAT':
            compressed.extend(payload)
        elif kind == b'IEND':
            if size or end != len(data) or not compressed:
                raise ValueError
            height, stride = header
            decoder = zlib.decompressobj()
            pixels = decoder.decompress(compressed, height * stride + 1)
            if (len(pixels) != height * stride or not decoder.eof or decoder.unused_data
                    or any(f > 4 for f in pixels[::stride])):
                raise ValueError
            return bytes(output + data[pos:end])
        elif not kind[0] & 32:
            raise ValueError
        if kind in (b'IHDR', b'IDAT'):
            output.extend(data[pos:end])
        pos = end
    raise ValueError


def normalize(mime, data):
    if mime == 'image/png':
        try:
            return clean_png(data)
        except zlib.error as exc:
            raise ValueError from exc
    if (mime == 'application/pdf' and re.match(rb'%PDF-(?:1\.[0-9]|2\.0)[\r\n]', data)
            and data.rstrip(b'\0\r\n\t ').endswith(b'%%EOF')):
        return data
    raise ValueError
