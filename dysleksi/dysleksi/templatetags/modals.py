from django import template

register = template.Library()


def get_base_context(modal_id: str) -> dict:
    modal_labelled_by = f"{modal_id}-label"  # pragma: no cover
    return {  # pragma: no cover
        "modal_id": modal_id,
        "modal_labelled_by": modal_labelled_by,
    }


@register.inclusion_tag("dysleksi/admin/modals/error.html")
def error_modal(takes_context=True):
    return get_base_context("error")  # pragma: no cover


@register.inclusion_tag("dysleksi/admin/modals/cancel_group_test.html")
def cancel_group_test_modal(takes_context=True):
    return get_base_context("cancel-test")


@register.inclusion_tag("dysleksi/admin/modals/cancel_individual_test.html")
def cancel_individual_test_modal(takes_context=True):
    return get_base_context("cancel-test")
