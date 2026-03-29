import requests
import uuid

def test_upload_full():
    url_base = "http://127.0.0.1:8000/api"
    
    # Register/Login
    email = f"test_{uuid.uuid4()}@example.com"
    password = "password123"
    
    res = requests.post(f"{url_base}/auth/register", json={"email": email, "password": password})
    if res.status_code not in (200, 201):
        print(f"Register failed: {res.text}")
        return
        
    res = requests.post(f"{url_base}/auth/login", json={"email": email, "password": password})
    if res.status_code != 200:
        print(f"Login failed: {res.text}")
        return
        
    token = res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Upload
    files = {'file': ('test_upload.txt', b'This is a valid test document.')}
    try:
        response = requests.post(f"{url_base}/documents/upload", headers=headers, files=files)
        print(f"Upload Status Code: {response.status_code}")
        print(f"Upload Response: {response.text}")
    except Exception as e:
        print(f"Upload Error: {e}")

if __name__ == "__main__":
    test_upload_full()
