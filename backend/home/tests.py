from wagtail.models import Page
from wagtail.test.utils import WagtailPageTestCase
from home.models import TutorialPage
import json

class FlowApiTests(WagtailPageTestCase):
    def setUp(self):
        # Get root page
        root = Page.get_first_root_node()
        
        # Create a tutorial page
        self.tutorial = TutorialPage(title="My Tutorial", slug="my-tutorial")
        root.add_child(instance=self.tutorial)
        self.tutorial.save_revision().publish()
        
    def test_save_flow(self):
        data = {
            "nodes": [
                {"id": 1, "type": "instruction", "title": "Do this", "data": {"text": "Hello world"}, "outputs": ["Next"]},
                {"id": 2, "type": "condition", "title": "Check X", "outputs": ["Yes", "No"]}
            ],
            "connections": [
                {"from": 1, "to": 2, "fromPort": 0}
            ]
        }
        
        response = self.client.post(
            f'/api/flow/save/{self.tutorial.id}/',
            data=json.dumps(data),
            content_type="application/json"
        )
        
        self.assertEqual(response.status_code, 200)
        
        # Refresh
        self.tutorial.refresh_from_db()
        
        # Verify JSON storage
        self.assertEqual(self.tutorial.flow_graph, data)
        
        # Verify StreamField generation
        # Step 1: Instruction
        steps = self.tutorial.steps
        self.assertEqual(len(steps), 2)
        
        # find the instruction step
        step1 = next(s for s in steps if s.value['step_id'] == '1')
        self.assertEqual(step1.value['title'], "Do this")
        
        # Content should contain 'Hello world'
        # content is a StreamValue. We can iterate it.
        text_found = False
        for block in step1.value['content']:
             if block.block_type == 'text' and 'Hello world' in str(block.value):
                 text_found = True
        self.assertTrue(text_found)

        # Options
        opts = step1.value['options']
        self.assertEqual(len(opts), 1)
        self.assertEqual(opts[0]['label'], 'Next')
        self.assertEqual(opts[0]['next_step_id'], '2')

from django.contrib.auth.models import User
from django.test import TestCase

class AuthApiTests(TestCase):
    def setUp(self):
        self.username = 'testuser_api'
        self.password = 'password123'
        self.user = User.objects.create_user(username=self.username, password=self.password)

    def test_api_login_success(self):
        response = self.client.post(
            '/api/login/',
            data=json.dumps({'username': self.username, 'password': self.password}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['username'], self.username)
        # Check that session cookie is set
        self.assertIn('sessionid', response.cookies)

    def test_api_login_failure(self):
        response = self.client.post(
            '/api/login/',
            data=json.dumps({'username': self.username, 'password': 'wrongpassword'}),
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 401)
        data = response.json()
        self.assertEqual(data['status'], 'error')

    def test_current_user_authenticated(self):
        self.client.login(username=self.username, password=self.password)
        response = self.client.get('/api/v2/me/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['is_authenticated'])
        self.assertEqual(data['username'], self.username)

    def test_current_user_anonymous(self):
        response = self.client.get('/api/v2/me/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data['is_authenticated'])

    def test_api_logout(self):
        self.client.login(username=self.username, password=self.password)
        response = self.client.post('/api/logout/')
        self.assertEqual(response.status_code, 200)
        
        # Verify user is logged out
        response = self.client.get('/api/v2/me/')
        data = response.json()
        self.assertFalse(data['is_authenticated'])

