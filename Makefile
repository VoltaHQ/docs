UV_ARGS = --with 'mkdocs>=1.6,<2' --with 'mkdocs-material>=9.5,<9.6'

.PHONY: serve build

serve:
	uvx $(UV_ARGS) mkdocs serve

build:
	uvx $(UV_ARGS) mkdocs build
