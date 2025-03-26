import os
import sys
import dotenv
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "app"))

from app import server

app = server.app


    
if __name__ == "__main__":

    app.run(debug=True, host='127.0.0.1', port=5022)