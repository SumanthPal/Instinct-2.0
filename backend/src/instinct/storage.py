"""Vendor-neutral object storage accessed exclusively through the S3 API."""

import os
from io import BytesIO
from typing import BinaryIO, Optional, Union

import boto3
from botocore.config import Config


class ObjectStorage:
    """Lazily configured S3-compatible object storage client."""

    def __init__(self) -> None:
        self._client = None
        self.uploaded_count = 0
        self.failed_count = 0

    @property
    def bucket(self) -> str:
        bucket = os.getenv("S3_BUCKET")
        if not bucket:
            raise RuntimeError("Object storage is not configured: S3_BUCKET is missing.")
        return bucket

    @property
    def client(self):
        if self._client is None:
            required = (
                "S3_ENDPOINT_URL",
                "S3_ACCESS_KEY_ID",
                "S3_SECRET_ACCESS_KEY",
            )
            missing = [name for name in required if not os.getenv(name)]
            if missing:
                raise RuntimeError(
                    "Object storage is not configured: missing " + ", ".join(missing)
                )

            self._client = boto3.client(
                "s3",
                endpoint_url=os.environ["S3_ENDPOINT_URL"],
                aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
                aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
                region_name=os.getenv("S3_REGION", "auto"),
                config=Config(
                    signature_version="s3v4",
                    request_checksum_calculation="when_required",
                    response_checksum_validation="when_required",
                ),
            )
        return self._client

    def upload(
        self,
        object_key: str,
        body: Union[bytes, BytesIO, BinaryIO],
        *,
        content_type: str,
    ) -> str:
        """Upload an object and return its stable key, not a provider URL."""
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=object_key.lstrip("/"),
                Body=body,
                ContentType=content_type,
                ContentDisposition="inline",
            )
        except Exception:
            self.failed_count += 1
            raise

        self.uploaded_count += 1
        return object_key.lstrip("/")

    def report(self) -> str:
        """Return upload hit/miss counts for the current scraper session."""
        return f"image mirrors: uploaded={self.uploaded_count}, failed={self.failed_count}"


_storage: Optional[ObjectStorage] = None


def get_storage() -> ObjectStorage:
    """Return the process-wide storage client without connecting at import time."""
    global _storage
    if _storage is None:
        _storage = ObjectStorage()
    return _storage
