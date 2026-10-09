# Publish Freshbite with Render

This repository includes a Render Blueprint. It deploys the customer storefront and JDK API together at one public HTTPS address. The admin orders dashboard is at `/admin` and requires HTTP Basic sign-in.

## Create the Render service

1. Create or sign in to your Render account at https://dashboard.render.com/register.
2. Select **New** → **Blueprint** and connect the GitHub repository `naikrohidas751-cmd/Freshbite-`.
3. Select the `main` branch and confirm the `render.yaml` Blueprint.
4. Review the paid service and persistent disk costs before creating it. The current Blueprint uses the 0.5 CPU / 512 MB web plan and a 1 GB disk so saved customer orders survive restarts and deployments.
5. When the deploy finishes, open the service's `Environment` page to find the generated `ADMIN_PASSWORD`. The admin username is `freshbite-admin`.

The public customer page is the service root. The protected orders dashboard is the same URL followed by `/admin`.

## Local development

The Java server binds to `127.0.0.1` by default and saves orders in `backend-java/data`. Render overrides `HOST`, `PORT`, and `DATA_DIR` through environment variables. When using VS Code Live Server on port 5500, the frontend continues to use the local API at port 5000.