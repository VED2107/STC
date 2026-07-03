export { generateMetadata } from "../../courses/[id]/page";
import CourseDetailPage from "../../courses/[id]/page";

export const revalidate = 300;

export default CourseDetailPage;
