"""Instagram locators.

Keep every Selenium locator here so an Instagram markup change is a one-file fix.
"""

from selenium.webdriver.common.by import By

# Login and account state
LOGIN_USERNAME = (
    By.CSS_SELECTOR,
    "input[autocomplete*='username'], input[name='email'], input[name='username']",
)
LOGIN_PASSWORD = (
    By.CSS_SELECTOR,
    "input[type='password'], input[name='pass'], input[name='password']",
)
LOGIN_SUBMIT = (By.CSS_SELECTOR, "input[type='submit']")
AUTHENTICATED_AFFORDANCE = (By.CSS_SELECTOR, "a[href*='/direct/inbox']")
LOGIN_ERROR = (
    By.XPATH,
    "//form//*[@role='alert' or @aria-live='assertive'] | "
    "//*[@role='alert' or @aria-live='assertive']",
)

# Rate-limit / page-content checks
POST_CONTENT = (By.CSS_SELECTOR, "article img, div[role='presentation'] img")
STORY_CONTENT = (By.CSS_SELECTOR, "div[role='dialog'] img, div[role='presentation']")

# Posts
POST_CAPTION = (By.XPATH, "//article//span[string-length(normalize-space()) > 20]")
POST_DATETIME = (By.XPATH, "//article//time[@datetime]")
POST_IMAGE = (By.XPATH, "//article//img[contains(@src, 'cdninstagram.com')]")
POST_VIDEO_POSTER = (By.CSS_SELECTOR, "article video[poster]")

# Profile
INVALID_PROFILE = (
    By.XPATH,
    '//span[contains(normalize-space(), "Sorry, this page isn\'t available")] ',
)
PROFILE_EXTERNAL_LINK = (
    By.XPATH,
    "//a[@rel='me nofollow noopener noreferrer' and @target='_blank']",
)
PROFILE_LINK_TRIGGERS = (
    (
        By.XPATH,
        "//*[@role='button' and (normalize-space()='more' or "
        ".//*[normalize-space()='more'] or contains(normalize-space(), ' and '))]",
    ),
    (By.XPATH, "//button[normalize-space()='more' or .//*[normalize-space()='more']]"),
)
CLOSE_DIALOG = (By.CSS_SELECTOR, "div[aria-label='Close']")
PAGE_BODY = (By.TAG_NAME, "body")
PROFILE_POST_LINKS = (By.XPATH, "//a[contains(@href, '/p/')]")
PROFILE_MORE_BUTTON = (
    By.XPATH,
    "//*[@role='button' and (normalize-space()='more' or .//*[normalize-space()='more'])]",
)

# Consent and post-login housekeeping
SAVE_LOGIN_INFO = (By.XPATH, "//button[contains(normalize-space(), 'Save info')]")
ALLOW_COOKIES = (By.XPATH, "//button[contains(normalize-space(), 'Allow all cookies')]")
