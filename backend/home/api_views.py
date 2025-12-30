import json
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from .models import TutorialPage
from django.contrib.auth import authenticate, login, logout

@csrf_exempt
@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return JsonResponse({'status': 'success', 'username': user.get_username()})
        else:
            return JsonResponse({'status': 'error', 'message': 'Invalid credentials'}, status=401)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

@csrf_exempt
@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({'status': 'success'})

@csrf_exempt
@require_GET
def get_flow_view(request, page_id):
    page = get_object_or_404(TutorialPage, id=page_id)
    if not page.flow_graph:
        return JsonResponse({'nodes': [], 'connections': []})
    return JsonResponse(page.flow_graph)


@csrf_exempt
@require_GET
def current_user_view(request):
    user = request.user
    if user.is_authenticated:
        return JsonResponse({
            'is_authenticated': True,
            'username': user.get_username(),
            'admin_url': '/admin/'
        })
    else:
        return JsonResponse({
            'is_authenticated': False,
            'username': '',
            'admin_url': '/admin/'
        })


@csrf_exempt
@require_POST
def save_flow_view(request, page_id):
    try:
        data = json.loads(request.body)
        nodes = data.get('nodes', [])
        connections = data.get('connections', [])
        
        page = get_object_or_404(TutorialPage, id=page_id)
        
        # 1. Save Graph (Raw editor state)
        page.flow_graph = data
        
        # 2. Convert to StreamField (steps)
        # We map the graph nodes to the linear StreamField 'steps'
        
        # Pre-process connections to map NodeID -> [Options]
        # Connection: { from: id, fromPort: idx, to: id }
        connections_map = {} 
        
        for conn in connections:
            from_id = conn.get('from')
            to_id = conn.get('to')
            port_index = conn.get('fromPort', 0)
            
            # Find the source node to get the output label
            from_node = next((n for n in nodes if n['id'] == from_id), None)
            output_label = "Next"
            if from_node and 'outputs' in from_node and len(from_node['outputs']) > port_index:
                output_label = from_node['outputs'][port_index]
            
            if from_id not in connections_map:
                connections_map[from_id] = []
            
            connections_map[from_id].append({
                'label': output_label,
                'target_id': str(to_id)
            })

        new_steps_data = []

        for node in nodes:
            node_type = node.get('type')
            
            # Skip 'Start' node in the content stream (it's just an entry point)
            # Unless we want to model it as a welcome step? 
            # Usually Start -> First Step. The First Step is the real content.
            # But we might need to know WHICH step is first. 
            # The frontend logic usually finds the node connected to 'Start'.
            # For the TutorialPage model, order in StreamField doesn't determine flow logic strictly,
            # but usually the *first* block is the starting point if not specified otherwise.
            # However, looking at logic: Start node connects to Node X. Node X has ID.
            # We don't have a 'initial_step_id' field.
            # Maybe we should ensure the checking logic knows where to start?
            # For now, let's just dump the content nodes (Instruction, Condition).
            
            if node_type == 'start':
                continue
            
            step_id = str(node.get('id'))
            title = node.get('title', 'Step')
            
            # Prepare Content StreamBlock
            content_list = []
            if node_type == 'instruction':
                text = node.get('data', {}).get('text', '')
                if text:
                    # Wrap in simple paragraph for RichText
                    # or just pass raw string.
                    content_list.append(('text', text))
            
            # Prepare Options
            options_list = []
            node_conns = connections_map.get(node['id'], [])
            for opt in node_conns:
                options_list.append({
                    'label': opt['label'],
                    'next_step_id': opt['target_id']
                })
            
            # StructBlock value
            step_block_value = {
                'step_id': step_id,
                'title': title,
                'content': content_list,
                'options': options_list
            }
            
            # Append to main StreamField list
            new_steps_data.append(('step', step_block_value))
        
        # Update the page
        page.steps = new_steps_data
        
        # Publish change
        page.save_revision().publish()
        
        return JsonResponse({
            'status': 'success', 
            'message': f'Saved {len(new_steps_data)} steps.',
            'page_id': page.id
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
