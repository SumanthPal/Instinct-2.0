import subprocess
import os
import signal
import sys
import time

processes = []

def start_process(cmd):
    print(f"Starting: {cmd}")
    process = subprocess.Popen(cmd, shell=True)
    processes.append(process)
    return process

def signal_handler(sig, frame):
    print("Shutting down all services...")
    for process in processes:
        process.terminate()
    
    # Wait for processes to terminate
    for process in processes:
        process.wait()
    
    sys.exit(0)

def main():
    # Register signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Get environment variables to determine which services to run
    run_web = os.environ.get('RUN_WEB', 'true').lower() == 'true'
    run_scraper = os.environ.get('RUN_SCRAPER', 'true').lower() == 'true'
    run_discord = os.environ.get('RUN_DISCORD', 'true').lower() == 'true'
    
    # Start the services
    if run_web:
        start_process("python app/server.py")
    
    if run_scraper:
        start_process("python app/tools/scraper_rotation.py")
    
    if run_discord:
        start_process("python app/tools/discord_bot.py")
    
    # Keep the script running
    while True:
        time.sleep(1)
        
        # Check if any process has exited and restart it
        for i, process in enumerate(processes[:]):
            if process.poll() is not None:
                print(f"Process exited with code {process.returncode}. Restarting...")
                processes.remove(process)
                # Restart the process
                if i == 0 and run_web:
                    start_process("python app/server.py")
                elif i == 1 and run_scraper:
                    start_process("python app/tools/scraper_rotation.py")
                elif i == 2 and run_discord:
                    start_process("python app/tools/discord_bot.py")

if __name__ == "__main__":
    main()