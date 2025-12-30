import os
import django
from django.test import Client
from django.contrib.auth.models import User
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tutorial_cms.settings.dev")
django.setup()

def test_auth_api():
    client = Client()
    
    # 1. Unauthenticated
    resp = client.get('/api/v2/me/')
    data = json.loads(resp.content)
    print("Unauthenticated:", data)
    assert data['is_authenticated'] == False
    
    # 2. Authenticated
    username = 'testuser_nav'
    password = 'password123'
    if not User.objects.filter(username=username).exists():
        User.objects.create_user(username=username, password=password)
        
    client.login(username=username, password=password)
    resp = client.get('/api/v2/me/')
    data = json.loads(resp.content)
    print("Authenticated:", data)
    assert data['is_authenticated'] == True
    assert data['username'] == username

if __name__ == '__main__':
    test_auth_api()
