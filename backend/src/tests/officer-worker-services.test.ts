import { IComplaintImage } from "../models/complaint.model";

export const testOfficerWorkerServices = () => {
  const image1: IComplaintImage = {
    url: "https://example.com/image1.jpg",
    fileName: "image1.jpg",
    contentType: "image/jpeg",
  };

  const image2: IComplaintImage = {
    url: "https://example.com/image2.jpg",
    fileName: "image2.jpg",
    contentType: "image/jpeg",
  };

  return image1.url && image2.url;
};
