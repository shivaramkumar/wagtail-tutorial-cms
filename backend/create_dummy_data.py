from home.models import TutorialPage
from wagtail.models import Page, Site

# Cleanup broken page 3 if exists
try:
    p3 = Page.objects.get(id=3)
    print(f"Deleting broken page: {p3}")
    p3.delete()
except Page.DoesNotExist:
    pass
except Exception as e:
    print(f"Error deleting page 3: {e}")
    # Force delete if needed or ignore

root = Page.objects.get(id=1)

# Create Tutorial
tutorial = TutorialPage(
    title="Internet Connection Troubleshooting",
    description="A step-by-step guide to fixing your internet connection.",
    slug="internet-troubleshooting"
)

# Defined steps
tutorial.steps = [
    ('step', {
        'step_id': 'start',
        'title': 'Is the router on?',
        'content': [('text', '<p>Check if the power lights on your router are green and blinking.</p>')],
        'options': [
            {'label': 'Yes, they are on', 'next_step_id': 'check-cables'},
            {'label': 'No, it is off', 'next_step_id': 'turn-on-router'}
        ]
    }),
    ('step', {
        'step_id': 'turn-on-router',
        'title': 'Turn on the router',
        'content': [('text', '<p>Plug in the power cable and press the <b>ON</b> button. Wait 30 seconds.</p>')],
        'options': [
            {'label': 'I did that', 'next_step_id': 'start'}
        ]
    }),
    ('step', {
        'step_id': 'check-cables',
        'title': 'Check Cables',
        'content': [('text', '<p>Ensure the ethernet cable is plugged in tightly to the WAN port.</p>')],
        'options': [
            {'label': 'Still no internet', 'next_step_id': 'contact-isp'},
            {'label': 'It works now!', 'next_step_id': ''}
        ]
    }),
    ('step', {
        'step_id': 'contact-isp',
        'title': 'Contact ISP',
        'content': [('text', '<p>It looks like an issue with your provider. Please call their support line.</p>')],
        'options': []
    })
]

root.add_child(instance=tutorial)
tutorial.save_revision().publish()
print(f"Created tutorial: {tutorial.title} (ID: {tutorial.id})")

# Update Site
site = Site.objects.first()
if site:
    site.root_page = tutorial
    site.save()
    print(f"Updated Site to point to {tutorial.title}")
else:
    Site.objects.create(hostname='localhost', port=8000, root_page=tutorial, is_default_site=True)
    print("Created new Site")
