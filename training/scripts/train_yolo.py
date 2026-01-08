# YOLO 모델 학습 스크립트
import argparse
import sys
import os
import json

def main():
    parser = argparse.ArgumentParser(description='YOLO 모델 학습')
    parser.add_argument('--dataset', type=str, required=True, help='데이터셋 경로')
    parser.add_argument('--epochs', type=int, default=100, help='학습 에포크 수')
    parser.add_argument('--batch-size', type=int, default=16, help='배치 크기')
    parser.add_argument('--learning-rate', type=float, default=0.001, help='학습률')
    parser.add_argument('--image-size', type=int, default=640, help='이미지 크기')
    
    args = parser.parse_args()
    
    print(f"=== YOLO 모델 학습 시작 ===")
    print(f"데이터셋: {args.dataset}")
    print(f"에포크: {args.epochs}")
    print(f"배치 크기: {args.batch_size}")
    print(f"학습률: {args.learning_rate}")
    print(f"이미지 크기: {args.image_size}")
    print()
    
    # 데이터셋 경로 확인
    if not os.path.exists(args.dataset):
        print(f"오류: 데이터셋 경로를 찾을 수 없습니다: {args.dataset}")
        sys.exit(1)
    
    images_path = os.path.join(args.dataset, 'images')
    labels_path = os.path.join(args.dataset, 'labels')
    
    if not os.path.exists(images_path):
        print(f"오류: 이미지 폴더를 찾을 수 없습니다: {images_path}")
        sys.exit(1)
    
    if not os.path.exists(labels_path):
        print(f"경고: 라벨 폴더를 찾을 수 없습니다: {labels_path}")
        print("라벨 폴더를 생성합니다...")
        os.makedirs(labels_path, exist_ok=True)
    
    # 이미지 파일 개수 확인
    image_files = [f for f in os.listdir(images_path) if f.lower().endswith(('.jpg', 'jpeg', '.png', '.webp'))]
    print(f"발견된 이미지 파일: {len(image_files)}개")
    
    if len(image_files) == 0:
        print("오류: 학습할 이미지가 없습니다.")
        sys.exit(1)
    
    # YOLO 데이터셋 설정 파일 생성
    dataset_config = {
        'path': args.dataset,
        'train': 'images',
        'val': 'images',  # 검증 데이터셋이 없으면 학습 데이터 사용
        'nc': 2,  # 클래스 개수 (person, background)
        'names': ['person', 'background']
    }
    
    config_path = os.path.join(args.dataset, 'dataset.yaml')
    with open(config_path, 'w', encoding='utf-8') as f:
        import yaml
        try:
            yaml.dump(dataset_config, f, default_flow_style=False, allow_unicode=True)
        except:
            # yaml이 없으면 JSON으로 저장
            json.dump(dataset_config, f, indent=2, ensure_ascii=False)
    
    print(f"데이터셋 설정 파일 생성: {config_path}")
    print()
    
    # 실제 학습 코드
    try:
        # ultralytics YOLO 사용 시도
        try:
            from ultralytics import YOLO
            print("Ultralytics YOLO를 사용하여 학습을 시작합니다...")
            print("주의: 실제 학습을 위해서는 GPU가 권장됩니다.")
            print()
            
            # 사전 학습된 모델 로드
            model = YOLO('yolov8n.pt')  # nano 모델 (가장 작고 빠름)
            
            # 학습 시작
            results = model.train(
                data=config_path,
                epochs=args.epochs,
                imgsz=args.image_size,
                batch=args.batch_size,
                lr0=args.learning_rate,
                device='cpu',  # GPU가 있으면 'cuda' 또는 '0'
                project='training/models',
                name='yolo_training',
                exist_ok=True
            )
            
            print()
            print("=== 학습 완료 ===")
            print(f"모델 저장 위치: training/models/yolo_training")
            
        except ImportError:
            print("Ultralytics 패키지가 설치되지 않았습니다.")
            print("설치 방법: pip install ultralytics")
            print()
            print("시뮬레이션 모드로 실행합니다...")
            
            # 시뮬레이션: 학습 진행 상황 출력
            for epoch in range(1, args.epochs + 1):
                # 진행률 계산
                progress = (epoch / args.epochs) * 100
                
                # 손실 시뮬레이션 (점진적으로 감소)
                train_loss = 0.5 * (0.9 ** epoch)
                val_loss = 0.6 * (0.9 ** epoch)
                
                print(f"Epoch {epoch}/{args.epochs} - Loss: {train_loss:.4f} - Val Loss: {val_loss:.4f}")
                
                # 10 에포크마다 상세 정보 출력
                if epoch % 10 == 0:
                    print(f"  Progress: {progress:.1f}%")
            
            print()
            print("=== 학습 완료 (시뮬레이션) ===")
            print("실제 학습을 위해서는 다음을 설치하세요:")
            print("  pip install ultralytics")
            print("  pip install torch torchvision")
            
    except Exception as e:
        print(f"학습 중 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
