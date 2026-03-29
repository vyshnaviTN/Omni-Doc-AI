import requests
import json
import uuid

def test_chat():
    url_base = "http://127.0.0.1:8000/api"
    
    # Register/Login
    email = f"chat_test_{uuid.uuid4()}@example.com"
    password = "password123"
    
    requests.post(f"{url_base}/auth/register", json={"email": email, "password": password})
    res = requests.post(f"{url_base}/auth/login", json={"email": email, "password": password})
    
    if res.status_code != 200:
        print(f"Login failed: {res.text}")
        return
        
    token = res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    print("Sending chat request...")
    res = requests.post(f"{url_base}/chat/", headers=headers, json={"query": "Hello", "session_id": ""}, stream=True)
    
    print(f"Chat status: {res.status_code}")
    if res.status_code != 200:
        print(f"Chat error: {res.text}")
        return
        
    for line in res.iter_lines():
        if line:
            print(line.decode('utf-8'))

if __name__ == "__main__":
    test_chat()
