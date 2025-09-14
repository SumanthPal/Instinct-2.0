class ScraperException(Exception):
    """Base exception class for scraper errors."""

    pass


class RateLimitException(ScraperException):
    """Exception raised when the rate limit is exceeded."""

    def __init__(self, message="Rate limit exceeded. Please try again later."):
        self.message = message
        super().__init__(self.message)


class LoginFailedException(ScraperException):
    """Exception raised when login fails."""

    def __init__(self, message="Login failed. Please check your credentials."):
        self.message = message
        super().__init__(self.message)


class ProfileNotFoundException(ScraperException):
    """Exception raised when a profile is not found."""

    def __init__(self, message="Profile not found. Please check the username."):
        self.message = message
        super().__init__(self.message)
