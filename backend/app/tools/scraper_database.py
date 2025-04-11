import sqlite3

def run_db(scraper_dict: dict):
    connection = None
    try:
        connection = sqlite3.connect("/Users/vaibhav_satish/Desktop/github/Instinct-2.0/backend/app/tools/scraper.db", isolation_level=None)
        _execute_statement(connection, scraper_dict)
    except sqlite3.Error as e:
        print('Could not add to db')

def _execute_statement(connection, scraper_dict):
    for scraper_data in scraper_dict.values():
        connection.execute(scraper_data)

def create_table(connection):
    statement = "CREATE TABLE Scraper_data"
    connection.execute(statement)

def add_statement() -> str:
    statement = "INSERT INTO "
    