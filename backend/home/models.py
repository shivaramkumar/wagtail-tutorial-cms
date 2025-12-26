from django.db import models
from wagtail.models import Page
from wagtail.fields import StreamField
from wagtail import blocks
from wagtail.images.blocks import ImageChooserBlock
from wagtail.embeds.blocks import EmbedBlock
from wagtail.admin.panels import FieldPanel
from wagtail.api import APIField

class OptionBlock(blocks.StructBlock):
    label = blocks.CharBlock(help_text="Button text")
    next_step_id = blocks.CharBlock(required=False, help_text="ID of the next step. Leave empty to end.")

    class Meta:
        label = "Option"

class StepBlock(blocks.StructBlock):
    step_id = blocks.CharBlock(help_text="Unique ID for this step (e.g. 'router-check')")
    title = blocks.CharBlock()
    content = blocks.StreamBlock([
        ('text', blocks.RichTextBlock()),
        ('image', ImageChooserBlock()),
        ('video', EmbedBlock()),
    ])
    options = blocks.ListBlock(OptionBlock())

    class Meta:
        label = "Step"

class TutorialPage(Page):
    description = models.TextField(blank=True)
    steps = StreamField([
        ('step', StepBlock()),
    ], use_json_field=True)

    content_panels = Page.content_panels + [
        FieldPanel('description'),
        FieldPanel('steps'),
    ]

    api_fields = [
        APIField('description'),
        APIField('steps'),
    ]
