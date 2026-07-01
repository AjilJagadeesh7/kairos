import { useParams } from 'react-router-dom'
import { SidebarShell } from '../components/organisms/Sidebar/SidebarShell'
import { AttachmentSidebar } from '../components/organisms/Attachments/AttachmentSidebar'
import { AttachmentViewer } from '../components/organisms/Attachments/AttachmentViewer'
import { AttachmentGallery } from '../components/organisms/Attachments/AttachmentGallery'

/** The Attachments section: its own sidebar (folder tree) + a viewer/gallery main area. */
export function AttachmentsPage(): JSX.Element {
  const { id } = useParams<{ id?: string }>()
  return (
    <SidebarShell resetKeys={[id]} sidebar={<AttachmentSidebar />}>
      {id ? <AttachmentViewer id={id} /> : <AttachmentGallery />}
    </SidebarShell>
  )
}
