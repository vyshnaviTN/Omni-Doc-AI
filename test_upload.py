import requests

def test_upload():
    url = "http://127.0.0.1:8000/api/documents/upload"
    files = {'file': ('test.txt', b'This is a test file for omni-doc upload.')}
    
    try:
        # We need authorization. Let's see if it works without auth (it shouldn't, returns 401).
        response = requests.post(url, files=files)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_upload()
