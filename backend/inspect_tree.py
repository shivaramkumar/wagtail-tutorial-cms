from wagtail.models import Page
for p in Page.objects.all():
    print(f"ID: {p.id}, Title: {p.title}, Depth: {p.depth}, Path: {p.path}, ContentType: {p.content_type}, Specific: {p.specific_class}")
