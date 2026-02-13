from django import template

register = template.Library()


def get_base_context(modal_id: str) -> dict:
    modal_labelled_by = f"{modal_id}-label"
    return {
        "modal_id": modal_id,
        "modal_labelled_by": modal_labelled_by,
    }


@register.inclusion_tag("dysleksi/admin/modals/assign_group.html")
def assign_group_modal(form=None, takes_context=True):
    context = get_base_context("assign_group")
    context["form"] = form
    return context
