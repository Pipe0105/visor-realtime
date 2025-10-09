from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.branch import Branch

router = APIRouter()

@router.get("/")
def get_branches(db: Session = Depends(get_db)):
    branches = db.query(Branch).all()
    return {
        "branches": [
            {"id": str(b.id), "name": b.name, "code": b.code}
            for b in branches
        ]
    }

@router.post("/")
def create_branch(name: str, code: str = None, db: Session = Depends(get_db)):
    """Create a new branch in the database."""
    new_branch = Branch(name=name, code=code)
    db.add(new_branch)
    db.commit()
    db.refresh(new_branch)
    return {"message": "Branch created successfully", "branch": {"id": str(new_branch.id), "name": new_branch.name}}
