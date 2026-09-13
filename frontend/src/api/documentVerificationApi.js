import apiClient from "./apiClient";

export const getDocumentVerification = async () => {
  const response = await apiClient.get("/vendor/document-verification");
  return response.data.data;
};

export const submitDocumentVerification = async ({ files, remarks }) => {
  const formData = new FormData();

  if (files.gstCertificate) formData.append("gstCertificate", files.gstCertificate);
  if (files.msmeCertificate) formData.append("msmeCertificate", files.msmeCertificate);
  if (files.identityProof) formData.append("identityProof", files.identityProof);

  formData.append("gstRemarks", remarks.gstRemarks);
  formData.append("msmeRemarks", remarks.msmeRemarks);
  formData.append("identityRemarks", remarks.identityRemarks);

  const response = await apiClient.post(
    "/vendor/document-verification/submit",
    formData
  );

  return response.data;
};
