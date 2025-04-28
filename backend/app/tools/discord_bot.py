from bot.auxiliary_bot import aux_bot
from bot.job_bot import job_bot
import threading
import os

def run_aux():
    AUX_BOT_TOKEN = os.getenv('AUX_BOT_TOKEN')
    aux_bot.run(AUX_BOT_TOKEN)

def run_job():
    JOB_BOT_TOKEN = os.getenv('JOB_BOT_TOKEN')
    job_bot.run(JOB_BOT_TOKEN)

if __name__ == "__main__":
    aux_thread = threading.Thread(target=run_aux)
    job_thread = threading.Thread(target=run_job)

    aux_thread.start()
    job_thread.start()

    aux_thread.join()
    job_thread.join()
