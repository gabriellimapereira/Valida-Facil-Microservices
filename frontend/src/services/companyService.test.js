import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPostFormData = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock("../lib/apiClient", () => ({
  getAccessToken: () => "test-token",
  apiClient: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
    postFormData: (...args) => mockApiPostFormData(...args),
    patch: (...args) => mockApiPatch(...args),
    delete: (...args) => mockApiDelete(...args),
  },
}));

import {
  fetchCompany,
  updateCompany,
  createCompany,
  uploadCompanyLogo,
  removeCompanyLogo,
  fetchCompanyMembers,
  inviteTeamMember,
  updateMember,
  removeMember,
} from "./companyService";

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPostFormData.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
});

describe("companyService via API Gateway", () => {
  it("maps company fields and uses Identity endpoints", async () => {
    mockApiGet.mockResolvedValue({
      id: "c1",
      name: "Empresa",
      notification_email: "estoque@empresa.com",
      logo_url: "/storage/logos/c1/logo.png",
    });
    await expect(fetchCompany("c1")).resolves.toMatchObject({
      id: "c1",
      notificationEmail: "estoque@empresa.com",
      logoUrl: "/storage/logos/c1/logo.png",
    });
    expect(mockApiGet).toHaveBeenCalledWith("/companies/me");

    mockApiPatch.mockResolvedValue({ id: "c1", name: "Atualizada", notification_email: "novo@empresa.com" });
    await expect(updateCompany("c1", { name: "Atualizada", notificationEmail: "novo@empresa.com" }))
      .resolves.toMatchObject({ name: "Atualizada", notificationEmail: "novo@empresa.com" });
    expect(mockApiPatch).toHaveBeenCalledWith("/companies/me", {
      name: "Atualizada",
      notification_email: "novo@empresa.com",
    });
  });

  it("creates a company through Identity", async () => {
    mockApiPost.mockResolvedValue({ id: "c2", name: "Nova", notification_email: "n@empresa.com" });
    await expect(createCompany({ name: "Nova", notificationEmail: "n@empresa.com" }))
      .resolves.toMatchObject({ id: "c2", notificationEmail: "n@empresa.com" });
    expect(mockApiPost).toHaveBeenCalledWith("/companies", {
      name: "Nova",
      notification_email: "n@empresa.com",
    });
  });

  it("uploads and removes a logo through the backend", async () => {
    const file = new File(["logo"], "logo.png", { type: "image/png" });
    mockApiPostFormData.mockResolvedValue({ id: "c1", logo_url: "/storage/logos/c1/logo.png" });
    await expect(uploadCompanyLogo("c1", file)).resolves.toMatchObject({
      logoUrl: "/storage/logos/c1/logo.png",
    });
    expect(mockApiPostFormData).toHaveBeenCalledWith("/companies/logo", expect.any(FormData));

    mockApiDelete.mockResolvedValue({ id: "c1", logo_url: null });
    await expect(removeCompanyLogo()).resolves.toMatchObject({ logoUrl: null });
    expect(mockApiDelete).toHaveBeenCalledWith("/companies/logo");
  });

  it("uses the API for members, invitations, edits and removals", async () => {
    mockApiGet.mockResolvedValue([
      { id: "u1", full_name: "Ana", email: "ana@empresa.com", role: "operador", store_id: "s1", store_name: "Centro" },
    ]);
    await expect(fetchCompanyMembers("c1")).resolves.toMatchObject([
      { id: "u1", fullName: "Ana", storeId: "s1", storeName: "Centro" },
    ]);

    mockApiPost.mockResolvedValue({ user_id: "u2", email: "b@empresa.com" });
    await inviteTeamMember({ email: "b@empresa.com", fullName: "Bia", storeId: "s1" });
    expect(mockApiPost).toHaveBeenCalledWith("/companies/invite", {
      email: "b@empresa.com",
      full_name: "Bia",
      role: "operador",
      store_id: "s1",
    });

    mockApiPatch.mockResolvedValue({ id: "u1", full_name: "Ana", store_id: null });
    await expect(updateMember("u1", { storeId: null })).resolves.toMatchObject({ storeId: null });
    expect(mockApiPatch).toHaveBeenCalledWith("/companies/members/u1", { store_id: null });

    mockApiDelete.mockResolvedValue(null);
    await removeMember("u1");
    expect(mockApiDelete).toHaveBeenCalledWith("/companies/members/u1");
  });
});
