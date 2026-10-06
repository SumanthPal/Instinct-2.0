"""Stored image keys -> public CDN URLs, in one place."""

import os
from typing import Optional

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def image_key(path) -> Optional[str]:
    """The stored object key (e.g. "pfps/acm.jpg"), or None when there is no image.

    None, "", whitespace and the string "NULL" all mean no image. "NULL" was
    the old column default of posts.image_path and clubs.profile_image_path,
    so rows written before that default was dropped still carry it.
    """
    if not isinstance(path, str):
        return None
    key = path.strip().lstrip("/")
    if not key or key.upper() == "NULL":
        return None
    return key


def cdn_url(path, default_extension: Optional[str] = None) -> Optional[str]:
    """Public URL for a stored image key, or None when there is no image.

    default_extension is appended to a key without an image extension (post
    images were mirrored as "posts/<handle>/<id>" and served as .jpg).
    """
    key = image_key(path)
    if key is None:
        return None
    if default_extension and not key.lower().endswith(IMAGE_EXTENSIONS):
        key += default_extension
    return f"{os.getenv('S3_PUBLIC_URL', '')}/{key}"
