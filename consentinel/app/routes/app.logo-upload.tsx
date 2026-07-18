/**
 * Logo image-picker upload endpoint (Pro).
 *
 * Receives a multipart image from the Banner settings screen, pushes it into
 * the store's Files via Shopify's staged-upload flow (stagedUploadsCreate →
 * POST the bytes → fileCreate), polls until the image is processed, and
 * returns the CDN URL that Banner settings stores as ShopSettings.logoUrl.
 * Requires the write_files scope (see shopify.app.toml).
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { canUseLogo } from "../models/billing.server";
import { getShopSettings } from "../models/shopSettings.server";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB is plenty for a banner logo
const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function uploadError(userErrors?: { message: string }[]) {
  const detail =
    userErrors?.map((userError) => userError.message).join("; ") || "Unknown error";
  return { ok: false as const, message: `Upload failed: ${detail}` };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  if (!canUseLogo(settings.plan)) {
    return { ok: false as const, message: "Logo upload requires the Pro plan" };
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, message: "Choose an image file first" };
  }
  if (!ALLOWED_TYPES[file.type]) {
    return { ok: false as const, message: "Use a PNG, JPG, WebP, or GIF image" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false as const, message: "Image must be 2MB or smaller" };
  }

  // 1. Reserve a staged upload target.
  const stagedResponse = await admin.graphql(
    `#graphql
    mutation consentinelStagedUpload($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: [
          {
            filename: file.name || `logo.${ALLOWED_TYPES[file.type]}`,
            mimeType: file.type,
            httpMethod: "POST",
            resource: "FILE",
          },
        ],
      },
    },
  );
  const stagedJson = await stagedResponse.json();
  const staged = stagedJson.data?.stagedUploadsCreate;
  const target = staged?.stagedTargets?.[0];
  if (!target || (staged?.userErrors?.length ?? 0) > 0) {
    return uploadError(staged?.userErrors);
  }

  // 2. Send the bytes to the staged target (parameters first, file last —
  // the order is required by the underlying S3/GCS form upload).
  const upload = new FormData();
  for (const parameter of target.parameters as { name: string; value: string }[]) {
    upload.append(parameter.name, parameter.value);
  }
  upload.append("file", file);
  const uploadResponse = await fetch(target.url, { method: "POST", body: upload });
  if (!uploadResponse.ok) {
    return {
      ok: false as const,
      message: `Upload failed (storage responded ${uploadResponse.status})`,
    };
  }

  // 3. Register the uploaded bytes as a store File.
  const createResponse = await admin.graphql(
    `#graphql
    mutation consentinelFileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id fileStatus }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        files: [
          {
            originalSource: target.resourceUrl,
            contentType: "IMAGE",
            alt: "Banner logo",
          },
        ],
      },
    },
  );
  const createJson = await createResponse.json();
  const created = createJson.data?.fileCreate;
  const fileId: string | undefined = created?.files?.[0]?.id;
  if (!fileId || (created?.userErrors?.length ?? 0) > 0) {
    return uploadError(created?.userErrors);
  }

  // 4. Poll briefly until Shopify has processed the image into a CDN URL.
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const nodeResponse = await admin.graphql(
      `#graphql
      query consentinelFileStatus($id: ID!) {
        node(id: $id) {
          ... on MediaImage {
            fileStatus
            image { url }
          }
        }
      }`,
      { variables: { id: fileId } },
    );
    const nodeJson = await nodeResponse.json();
    const node = nodeJson.data?.node;
    if (node?.fileStatus === "FAILED") {
      return { ok: false as const, message: "Shopify could not process that image" };
    }
    const url: string | undefined = node?.image?.url;
    if (node?.fileStatus === "READY" && url) {
      return { ok: true as const, url };
    }
  }
  return {
    ok: false as const,
    message:
      "The image is still processing — find it in Content → Files in a minute and paste its URL",
  };
};
