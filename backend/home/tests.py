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
