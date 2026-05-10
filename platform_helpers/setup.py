from setuptools import setup, find_packages

setup(
    name="platform_helpers",
    version="1.0.0",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "requests>=2.28.0",
        "pydantic>=2.0.0",
    ],
)